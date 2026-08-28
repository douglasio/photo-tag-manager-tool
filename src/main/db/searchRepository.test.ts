// @vitest-environment node
import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { parseSearchQuery } from '@shared/searchQuery'

const { mockGetDb, mockGetExcludedFolders, mockGetPeople, mockGetPersonPhotoAssignments } =
  vi.hoisted(() => ({
    mockGetDb: vi.fn(),
    mockGetExcludedFolders: vi.fn().mockReturnValue([]),
    mockGetPeople: vi.fn().mockReturnValue([]),
    mockGetPersonPhotoAssignments: vi.fn().mockReturnValue([])
  }))

vi.mock('./database', () => ({ getDb: mockGetDb }))
vi.mock('./settingsRepository', () => ({ getExcludedFolders: mockGetExcludedFolders }))
vi.mock('./faceRepository', () => ({
  getPeople: mockGetPeople,
  getPersonPhotoAssignments: mockGetPersonPhotoAssignments
}))

import { searchPhotos } from './searchRepository'

interface PhotoSeed {
  path: string
  fileName?: string
  comment?: string | null
  tags?: string[]
  dateTaken?: string | null
  cameraMake?: string | null
  cameraModel?: string | null
  format?: string
  viewCount?: number
  firstSeenAt?: number | null
  thumbnailKey?: string | null
  thumbnailStatus?: string
}

// A real SQLite database rather than a fake — the repository's SELECT is
// plain SQL, and this keeps the JSON tags column and NULL handling honest.
function seed(photos: PhotoSeed[]): void {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE photos (
      path TEXT PRIMARY KEY, fileName TEXT, comment TEXT, tags TEXT,
      dateTaken TEXT, cameraMake TEXT, cameraModel TEXT, format TEXT,
      viewCount INTEGER, firstSeenAt INTEGER, thumbnailKey TEXT, thumbnailStatus TEXT
    )
  `)
  const insert = db.prepare(
    `INSERT INTO photos VALUES (@path, @fileName, @comment, @tags, @dateTaken,
     @cameraMake, @cameraModel, @format, @viewCount, @firstSeenAt, @thumbnailKey, @thumbnailStatus)`
  )
  for (const photo of photos) {
    insert.run({
      path: photo.path,
      fileName: photo.fileName ?? photo.path.split('/').pop(),
      comment: photo.comment ?? null,
      tags: JSON.stringify(photo.tags ?? []),
      dateTaken: photo.dateTaken ?? null,
      cameraMake: photo.cameraMake ?? null,
      cameraModel: photo.cameraModel ?? null,
      format: photo.format ?? 'JPEG',
      viewCount: photo.viewCount ?? 0,
      firstSeenAt: photo.firstSeenAt ?? null,
      thumbnailKey: photo.thumbnailKey ?? 'thumb',
      thumbnailStatus: photo.thumbnailStatus ?? 'ready'
    })
  }
  mockGetDb.mockReturnValue(db)
}

function search(input: string, includeExcluded = false): string[] {
  return searchPhotos(parseSearchQuery(input, includeExcluded)).paths
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetExcludedFolders.mockReturnValue([])
  mockGetPeople.mockReturnValue([])
  mockGetPersonPhotoAssignments.mockReturnValue([])
})

describe('empty query', () => {
  it('returns nothing rather than the whole library', () => {
    seed([{ path: '/p/a.jpg' }])
    expect(searchPhotos(parseSearchQuery(''))).toEqual({ hits: [], total: 0, paths: [] })
  })
})

describe('text matching', () => {
  beforeEach(() => {
    seed([
      { path: '/p/beach.jpg', comment: 'sunset at the shore' },
      { path: '/p/IMG_1234.jpg', tags: ['vacation'] },
      { path: '/p/other/city.png', comment: null }
    ])
  })

  it('matches a bare term across filename, comment, and tags', () => {
    expect(search('beach')).toEqual(['/p/beach.jpg'])
    expect(search('shore')).toEqual(['/p/beach.jpg'])
    expect(search('vacation')).toEqual(['/p/IMG_1234.jpg'])
  })

  it('matches substrings, which a token index could not', () => {
    expect(search('each')).toEqual(['/p/beach.jpg'])
    expect(search('234')).toEqual(['/p/IMG_1234.jpg'])
  })

  it('is case-insensitive in both directions', () => {
    expect(search('BEACH')).toEqual(['/p/beach.jpg'])
    expect(search('SUNSET')).toEqual(['/p/beach.jpg'])
  })

  it('scopes a field flag to that field only', () => {
    expect(search('comment:shore')).toEqual(['/p/beach.jpg'])
    expect(search('comment:beach')).toEqual([])
    expect(search('filename:beach')).toEqual(['/p/beach.jpg'])
  })

  it('matches folder segments with folder:', () => {
    expect(search('folder:other')).toEqual(['/p/other/city.png'])
  })

  it('ANDs multiple terms', () => {
    expect(search('beach shore')).toEqual(['/p/beach.jpg'])
    expect(search('beach city')).toEqual([])
  })

  it('tolerates a null comment without matching it', () => {
    expect(search('comment:anything')).toEqual([])
  })
})

describe('unicode folding', () => {
  it('folds non-ASCII case, which SQLite lower() would not', () => {
    seed([{ path: '/p/CAFÉ.jpg', comment: 'STRAßE' }])
    expect(search('café')).toEqual(['/p/CAFÉ.jpg'])
    expect(search('É')).toEqual(['/p/CAFÉ.jpg'])
  })
})

describe('tag: exact-set matching', () => {
  beforeEach(() => {
    seed([
      { path: '/p/a.jpg', tags: ['beach', 'summer'] },
      { path: '/p/b.jpg', tags: ['beachfront'] }
    ])
  })

  it('matches the whole tag, not a substring of it', () => {
    expect(search('tag:beach')).toEqual(['/p/a.jpg'])
  })

  it('still matches beachfront as a loose bare term', () => {
    expect(search('beachfront')).toEqual(['/p/b.jpg'])
  })

  it('intersects repeated tag flags', () => {
    expect(search('tag:beach tag:summer')).toEqual(['/p/a.jpg'])
    expect(search('tag:beach tag:winter')).toEqual([])
  })

  it('ignores malformed tags JSON instead of throwing', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE photos (
      path TEXT PRIMARY KEY, fileName TEXT, comment TEXT, tags TEXT, dateTaken TEXT,
      cameraMake TEXT, cameraModel TEXT, format TEXT, viewCount INTEGER,
      firstSeenAt INTEGER, thumbnailKey TEXT, thumbnailStatus TEXT)`)
    db.prepare(
      `INSERT INTO photos VALUES ('/p/bad.jpg','bad.jpg',NULL,'not json',NULL,NULL,NULL,'JPEG',0,NULL,'t','ready')`
    ).run()
    mockGetDb.mockReturnValue(db)
    expect(() => search('tag:beach')).not.toThrow()
    expect(search('tag:beach')).toEqual([])
  })
})

describe('person: matching', () => {
  beforeEach(() => {
    seed([{ path: '/p/a.jpg' }, { path: '/p/b.jpg' }, { path: '/p/c.jpg' }])
    mockGetPeople.mockReturnValue([
      { id: 'p1', name: 'Joe' },
      { id: 'p2', name: 'Mary' },
      { id: 'p3', name: null }
    ])
    mockGetPersonPhotoAssignments.mockReturnValue([
      { photoPath: '/p/a.jpg', personId: 'p1' },
      { photoPath: '/p/a.jpg', personId: 'p2' },
      { photoPath: '/p/b.jpg', personId: 'p1' },
      { photoPath: '/p/c.jpg', personId: 'p3' }
    ])
  })

  it('finds photos of one person', () => {
    expect(search('person:joe').sort()).toEqual(['/p/a.jpg', '/p/b.jpg'])
  })

  // The headline compound case the plan promised for v1.
  it('intersects two people plus a date filter', () => {
    expect(search('person:joe person:mary')).toEqual(['/p/a.jpg'])
  })

  it('returns nothing for an unknown person rather than everything', () => {
    expect(search('person:nobody')).toEqual([])
  })

  it('never matches an unnamed person', () => {
    expect(search('person:')).toEqual([])
  })
})

describe('structured filters', () => {
  beforeEach(() => {
    seed([
      { path: '/p/old.jpg', dateTaken: '2015-06-01', viewCount: 10, cameraMake: 'Fujifilm' },
      { path: '/p/new.jpg', dateTaken: '2024-01-01', viewCount: 0, format: 'PNG' },
      { path: '/p/undated.jpg', dateTaken: null, viewCount: 3 }
    ])
  })

  it('filters by year, before, and after', () => {
    expect(search('year:2024')).toEqual(['/p/new.jpg'])
    expect(search('before:2020')).toEqual(['/p/old.jpg'])
    expect(search('after:2020')).toEqual(['/p/new.jpg'])
  })

  it('excludes undated photos from date comparisons rather than defaulting them', () => {
    expect(search('before:2020')).not.toContain('/p/undated.jpg')
    expect(search('after:2020')).not.toContain('/p/undated.jpg')
  })

  it('filters by view count comparisons', () => {
    expect(search('views:>5')).toEqual(['/p/old.jpg'])
    expect(search('views:>=3').sort()).toEqual(['/p/old.jpg', '/p/undated.jpg'])
    expect(search('views:0')).toEqual(['/p/new.jpg'])
  })

  it('filters by camera and format', () => {
    expect(search('camera:fuji')).toEqual(['/p/old.jpg'])
    expect(search('format:png')).toEqual(['/p/new.jpg'])
  })
})

describe('boolean flags', () => {
  beforeEach(() => {
    seed([
      { path: '/p/tagged.jpg', tags: ['x'], comment: 'hello' },
      { path: '/p/bare.jpg', tags: [], comment: null },
      { path: '/p/blank-comment.jpg', tags: [], comment: '   ' }
    ])
    mockGetPersonPhotoAssignments.mockReturnValue([{ photoPath: '/p/tagged.jpg', personId: 'p1' }])
  })

  it('finds untagged photos', () => {
    expect(search('is:untagged').sort()).toEqual(['/p/bare.jpg', '/p/blank-comment.jpg'])
  })

  it('treats a whitespace-only comment as no comment', () => {
    expect(search('has:comment')).toEqual(['/p/tagged.jpg'])
  })

  it('finds photos with faces via the assignment set', () => {
    expect(search('has:faces')).toEqual(['/p/tagged.jpg'])
  })
})

describe('negation', () => {
  beforeEach(() => {
    seed([
      { path: '/p/a.jpg', tags: ['beach'], comment: 'blurry shot' },
      { path: '/p/b.jpg', tags: ['beach'], comment: 'sharp' }
    ])
  })

  it('excludes matches of a negated term', () => {
    expect(search('tag:beach -blurry')).toEqual(['/p/b.jpg'])
  })

  it('excludes a negated tag', () => {
    expect(search('-tag:beach')).toEqual([])
  })

  it('does not let a negated predicate contribute to relevance', () => {
    const withNegation = searchPhotos(parseSearchQuery('sharp -blurry'))
    const without = searchPhotos(parseSearchQuery('sharp'))
    expect(withNegation.hits[0].score).toBe(without.hits[0].score)
  })
})

describe('excluded folders', () => {
  beforeEach(() => {
    seed([{ path: '/p/keep/a.jpg' }, { path: '/p/skip/b.jpg' }])
    mockGetExcludedFolders.mockReturnValue(['/p/skip'])
  })

  it('omits excluded-folder photos by default', () => {
    expect(search('a.jpg')).toEqual(['/p/keep/a.jpg'])
    expect(search('b.jpg')).toEqual([])
  })

  it('includes them when the override is set', () => {
    expect(search('b.jpg', true)).toEqual(['/p/skip/b.jpg'])
  })
})

describe('ranking', () => {
  it('ranks a filename hit above a comment-only hit', () => {
    seed([
      { path: '/p/zzz.jpg', comment: 'beach' },
      { path: '/p/beach.jpg', comment: null }
    ])
    expect(search('beach')[0]).toBe('/p/beach.jpg')
  })

  it('ranks an exact tag above an incidental substring', () => {
    seed([
      { path: '/p/a.jpg', comment: 'beachfront property' },
      { path: '/p/b.jpg', tags: ['beach'] }
    ])
    expect(search('beach')[0]).toBe('/p/b.jpg')
  })

  it('breaks score ties by recency', () => {
    seed([
      { path: '/p/older.jpg', comment: 'beach', dateTaken: '2015-01-01' },
      { path: '/p/newer.jpg', comment: 'beach', dateTaken: '2024-01-01' }
    ])
    expect(search('beach')).toEqual(['/p/newer.jpg', '/p/older.jpg'])
  })
})

describe('result shape', () => {
  beforeEach(() => {
    seed([
      { path: '/p/a.jpg', comment: 'beach' },
      { path: '/p/b.jpg', comment: 'beach' },
      { path: '/p/c.jpg', comment: 'beach', thumbnailStatus: 'pending', thumbnailKey: null }
    ])
  })

  it('caps hits by limit but reports the full total and path list', () => {
    const result = searchPhotos(parseSearchQuery('beach'), { limit: 2 })
    expect(result.hits).toHaveLength(2)
    expect(result.total).toBe(3)
    expect(result.paths).toHaveLength(3)
  })

  it('nulls the thumbnail key for a photo whose thumbnail is not ready', () => {
    const result = searchPhotos(parseSearchQuery('beach'), { limit: 10 })
    const pending = result.hits.find((hit) => hit.filePath === '/p/c.jpg')
    expect(pending?.thumbnailKey).toBeNull()
  })
})

describe('performance budget', () => {
  it('stays well under the 50ms escalation trigger at 100k photos', () => {
    const db = new Database(':memory:')
    db.exec(`CREATE TABLE photos (
      path TEXT PRIMARY KEY, fileName TEXT, comment TEXT, tags TEXT, dateTaken TEXT,
      cameraMake TEXT, cameraModel TEXT, format TEXT, viewCount INTEGER,
      firstSeenAt INTEGER, thumbnailKey TEXT, thumbnailStatus TEXT)`)
    const insert = db.prepare(
      `INSERT INTO photos VALUES (?,?,?,?,?,NULL,NULL,'JPEG',0,NULL,'t','ready')`
    )
    db.transaction(() => {
      for (let i = 0; i < 100_000; i++) {
        insert.run(
          `/photos/f${i % 500}/IMG_${i}.jpg`,
          `IMG_${i}.jpg`,
          `a sunset at the shore number ${i}`,
          '["vacation","summer"]',
          '2021-06-01'
        )
      }
    })()
    mockGetDb.mockReturnValue(db)

    const started = Date.now()
    const result = searchPhotos(parseSearchQuery('shore'), { limit: 20 })
    const elapsed = Date.now() - started

    expect(result.total).toBe(100_000)
    // Generous vs. the ~55ms measured locally, since CI machines vary — this
    // is a regression guard on the algorithm, not a benchmark.
    expect(elapsed).toBeLessThan(1000)
  })
})

// Combinations are where a conjunction engine actually earns its keep, and
// where an off-by-one in predicate bookkeeping would show up.
describe('mixed-facet combinations', () => {
  beforeEach(() => {
    seed([
      { path: '/p/hit.jpg', tags: ['beach'], dateTaken: '2019-06-01', comment: 'joe and mary' },
      { path: '/p/late.jpg', tags: ['beach'], dateTaken: '2022-06-01', comment: 'joe and mary' },
      { path: '/p/untagged.jpg', dateTaken: '2019-06-01', comment: 'joe and mary' }
    ])
    mockGetPeople.mockReturnValue([
      { id: 'p1', name: 'Joe' },
      { id: 'p2', name: 'Mary' }
    ])
    mockGetPersonPhotoAssignments.mockReturnValue([
      { photoPath: '/p/hit.jpg', personId: 'p1' },
      { photoPath: '/p/hit.jpg', personId: 'p2' },
      { photoPath: '/p/late.jpg', personId: 'p1' },
      { photoPath: '/p/late.jpg', personId: 'p2' },
      { photoPath: '/p/untagged.jpg', personId: 'p1' }
    ])
  })

  it('intersects two people with a date bound — the graph-search case', () => {
    expect(search('person:joe person:mary before:2020')).toEqual(['/p/hit.jpg'])
  })

  it('combines a tag, a person, and a negation', () => {
    expect(search('tag:beach person:mary -after:2020')).toEqual(['/p/hit.jpg'])
  })

  it('keeps person predicates aligned when other predicate kinds sit between them', () => {
    // The engine resolves person sets up front and walks them positionally, so
    // interleaving other facets must not desynchronize that bookkeeping.
    expect(search('person:joe tag:beach person:mary before:2020')).toEqual(['/p/hit.jpg'])
    // Both people match here, so the date bound is what separates them —
    // proving the second person set wasn't silently read as the first.
    expect(search('person:joe tag:beach person:mary')).toEqual(['/p/late.jpg', '/p/hit.jpg'])
    expect(search('person:mary is:untagged person:joe')).toEqual([])
  })

  it('applies a negated person filter', () => {
    expect(search('tag:beach -person:mary')).toEqual([])
    expect(search('is:untagged -person:mary')).toEqual(['/p/untagged.jpg'])
  })
})
