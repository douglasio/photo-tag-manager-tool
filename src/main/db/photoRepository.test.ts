// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

const {
  mockGetDb,
  mockGetExcludedFolders,
  mockReconcileTagGroups,
  mockDeleteEmbedding,
  mockRenameEmbedding,
  mockDeleteFacesForPhoto,
  mockRenameFacesForPhoto
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockGetExcludedFolders: vi.fn().mockReturnValue([]),
  mockReconcileTagGroups: vi.fn(),
  mockDeleteEmbedding: vi.fn(),
  mockRenameEmbedding: vi.fn(),
  mockDeleteFacesForPhoto: vi.fn(),
  mockRenameFacesForPhoto: vi.fn()
}))

vi.mock('./database', () => ({ getDb: mockGetDb }))
vi.mock('./settingsRepository', () => ({ getExcludedFolders: mockGetExcludedFolders }))
vi.mock('./tagMetadataRepository', () => ({ reconcileTagGroups: mockReconcileTagGroups }))
vi.mock('./embeddingRepository', () => ({
  deleteEmbedding: mockDeleteEmbedding,
  renameEmbedding: mockRenameEmbedding
}))
vi.mock('./faceRepository', () => ({
  deleteFacesForPhoto: mockDeleteFacesForPhoto,
  renameFacesForPhoto: mockRenameFacesForPhoto
}))

import * as photoRepository from './photoRepository'

interface FakeRow {
  path: string
  fileName: string
  mtimeMs: number
  sizeBytes: number
  tags: string
  dateTaken: string | null
  cameraMake: string | null
  cameraModel: string | null
  widthPx: number | null
  heightPx: number | null
  format: string
  comment: string | null
  thumbnailKey: string | null
  thumbnailStatus: string
  lastScannedAt: number
  viewCount: number
  firstSeenAt: number | null
  faceScannedAt: number | null
}

// Mimics just enough of better-sqlite3 to exercise photoRepository's actual
// SQL shapes (upsert, LIKE-prefix scans, instr() substring search, iterate,
// transaction) against a real in-memory Map, without a real SQLite file.
function createFakeDb(): { rows: Map<string, FakeRow>; embeddedPaths: Set<string> } {
  const rows = new Map<string, FakeRow>()
  // findReadyPhotosWithoutEmbeddings anti-joins against photo_embeddings
  // directly rather than going through embeddingRepository (mocked away
  // above) — this stands in for that table's rows.
  const embeddedPaths = new Set<string>()

  const db = {
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, ' ').trim()

      if (s.startsWith('SELECT * FROM photos WHERE path = ?')) {
        return { get: (path: string) => rows.get(path) }
      }
      if (s.startsWith('SELECT 1 FROM photos WHERE path = ?')) {
        return { get: (path: string) => (rows.has(path) ? 1 : undefined) }
      }
      if (s.startsWith('SELECT * FROM photos WHERE path LIKE ?')) {
        return {
          all: (prefix: string) => {
            const bare = prefix.slice(0, -1)
            return Array.from(rows.values()).filter((r) => r.path.startsWith(bare))
          }
        }
      }
      if (s.startsWith('INSERT INTO photos')) {
        return {
          run: (p: Record<string, unknown>) => {
            const existing = rows.get(p.path as string)
            rows.set(p.path as string, {
              path: p.path as string,
              fileName: p.fileName as string,
              mtimeMs: p.mtimeMs as number,
              sizeBytes: p.sizeBytes as number,
              tags: p.tags as string,
              dateTaken: p.dateTaken as string | null,
              cameraMake: p.cameraMake as string | null,
              cameraModel: p.cameraModel as string | null,
              widthPx: p.widthPx as number | null,
              heightPx: p.heightPx as number | null,
              format: p.format as string,
              comment: p.comment as string | null,
              thumbnailKey: p.thumbnailKey as string | null,
              thumbnailStatus: p.thumbnailStatus as string,
              lastScannedAt: p.lastScannedAt as number,
              viewCount: existing?.viewCount ?? 0,
              firstSeenAt: existing?.firstSeenAt ?? (p.firstSeenAt as number),
              faceScannedAt: existing?.faceScannedAt ?? null
            })
          }
        }
      }
      if (s.startsWith('UPDATE photos SET viewCount')) {
        return {
          run: (path: string) => {
            const row = rows.get(path)
            if (row) row.viewCount += 1
          }
        }
      }
      if (s.includes('instr(tags, ?)')) {
        return {
          iterate: (needle: string) => {
            const matches = Array.from(rows.values()).filter(
              (r) => r.thumbnailStatus === 'ready' && r.thumbnailKey && r.tags.includes(needle)
            )
            return matches[Symbol.iterator]()
          }
        }
      }
      // Checked before the findAllReadyPhotos handler below — both queries
      // share the same prefix, so the more specific one has to win.
      if (s.includes('faceScannedAt IS NULL') && s.startsWith('SELECT')) {
        return {
          all: () =>
            Array.from(rows.values())
              .filter((r) => r.thumbnailStatus === 'ready' && r.thumbnailKey)
              .filter((r) => r.faceScannedAt === null)
              .map((r) => ({ path: r.path, thumbnailKey: r.thumbnailKey }))
        }
      }
      if (s.startsWith('UPDATE photos SET faceScannedAt = ? WHERE path = ?')) {
        return {
          run: (at: number, path: string) => {
            const row = rows.get(path)
            if (row) row.faceScannedAt = at
          }
        }
      }
      if (s.startsWith('UPDATE photos SET faceScannedAt = NULL')) {
        return {
          run: () => {
            for (const row of rows.values()) row.faceScannedAt = null
          }
        }
      }
      if (s.startsWith('SELECT path, thumbnailKey FROM photos WHERE thumbnailStatus')) {
        return {
          all: () =>
            Array.from(rows.values()).filter((r) => r.thumbnailStatus === 'ready' && r.thumbnailKey)
        }
      }
      if (s.startsWith('SELECT p.path, p.thumbnailKey FROM photos p')) {
        return {
          all: () =>
            Array.from(rows.values())
              .filter((r) => r.thumbnailStatus === 'ready' && r.thumbnailKey)
              .filter((r) => !embeddedPaths.has(r.path))
              .map((r) => ({ path: r.path, thumbnailKey: r.thumbnailKey }))
        }
      }
      if (s.startsWith('SELECT path, thumbnailKey, dateTaken FROM photos')) {
        return {
          all: () =>
            Array.from(rows.values()).filter(
              (r) => r.thumbnailStatus === 'ready' && r.thumbnailKey && r.dateTaken
            )
        }
      }
      if (s.startsWith('SELECT path FROM photos WHERE thumbnailKey = ?')) {
        return {
          get: (key: string) => {
            const match = Array.from(rows.values()).find((r) => r.thumbnailKey === key)
            return match ? { path: match.path } : undefined
          }
        }
      }
      if (s.startsWith('UPDATE photos SET thumbnailKey')) {
        return {
          run: (key: string, status: string, path: string) => {
            const row = rows.get(path)
            if (row) {
              row.thumbnailKey = key
              row.thumbnailStatus = status
              row.faceScannedAt = null
            }
          }
        }
      }
      if (s.startsWith('SELECT thumbnailKey FROM photos WHERE path = ?')) {
        return { get: (path: string) => rows.get(path) }
      }
      if (s.startsWith('DELETE FROM photos WHERE path = ?')) {
        return { run: (path: string) => rows.delete(path) }
      }
      if (s.startsWith('UPDATE photos SET path = @newPath WHERE path = @oldPath')) {
        return {
          run: (p: { oldPath: string; newPath: string; fileName: string }) => {
            const row = rows.get(p.oldPath)
            if (!row) return
            rows.delete(p.oldPath)
            rows.set(p.newPath, { ...row, path: p.newPath, fileName: p.fileName })
          }
        }
      }
      if (s.startsWith('SELECT path FROM photos WHERE path LIKE ?')) {
        return {
          all: (prefix: string) => {
            const bare = prefix.slice(0, -1)
            return Array.from(rows.values())
              .filter((r) => r.path.startsWith(bare))
              .map((r) => ({ path: r.path }))
          }
        }
      }
      if (s.startsWith('UPDATE photos SET path = @newPath WHERE path = @oldPath')) {
        return {
          run: (p: { oldPath: string; newPath: string }) => {
            const row = rows.get(p.oldPath)
            if (!row) return
            rows.delete(p.oldPath)
            rows.set(p.newPath, { ...row, path: p.newPath })
          }
        }
      }
      if (s.startsWith('SELECT path, thumbnailKey FROM photos WHERE path LIKE ?')) {
        return {
          all: (prefix: string) => {
            const bare = prefix.slice(0, -1)
            return Array.from(rows.values())
              .filter((r) => r.path.startsWith(bare))
              .map((r) => ({ path: r.path, thumbnailKey: r.thumbnailKey }))
          }
        }
      }
      throw new Error(`Unhandled fake SQL: ${s}`)
    },
    transaction<T>(fn: (arg: T) => void) {
      return (arg: T): void => fn(arg)
    }
  }

  mockGetDb.mockReturnValue(db)
  return { rows, embeddedPaths }
}

function makeRecord(filePath: string, overrides: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: filePath,
    filePath,
    fileName: filePath.split('/').pop() ?? filePath,
    tags: [],
    metadata: {
      dateTaken: null,
      cameraMake: null,
      cameraModel: null,
      widthPx: null,
      heightPx: null,
      fileSizeBytes: 0,
      format: 'JPEG',
      comment: null
    },
    thumbnailStatus: 'pending',
    thumbnailKey: null,
    scanError: null,
    fromCache: false,
    viewCount: 0,
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetExcludedFolders.mockReturnValue([])
})

describe('upsertPhoto + findByPath', () => {
  it('round-trips a new record and coerces tags to strings', () => {
    createFakeDb()
    photoRepository.upsertPhoto(makeRecord('/a.jpg', { tags: ['x', 'y'] }), 100, 200)

    const found = photoRepository.findByPath('/a.jpg')
    expect(found?.record.tags).toEqual(['x', 'y'])
    expect(found?.mtimeMs).toBe(100)
    expect(found?.sizeBytes).toBe(200)
  })

  it('returns null for a path that was never inserted', () => {
    createFakeDb()
    expect(photoRepository.findByPath('/missing.jpg')).toBeNull()
  })

  it('photoExists reports true for a tracked photo and false otherwise', () => {
    createFakeDb()
    photoRepository.upsertPhoto(makeRecord('/a.jpg'), 100, 200)

    expect(photoRepository.photoExists('/a.jpg')).toBe(true)
    expect(photoRepository.photoExists('/missing.jpg')).toBe(false)
  })

  it('preserves firstSeenAt and viewCount across a re-upsert (rescan), unlike other fields', () => {
    createFakeDb()
    photoRepository.upsertPhoto(makeRecord('/a.jpg'), 100, 200)
    photoRepository.incrementViewCount('/a.jpg')
    const firstSeenAt = photoRepository.findByPath('/a.jpg')?.record.firstSeenAt

    // Re-upsert with different metadata, simulating a rescan.
    photoRepository.upsertPhoto(makeRecord('/a.jpg', { tags: ['new'] }), 150, 250)

    const after = photoRepository.findByPath('/a.jpg')
    expect(after?.record.tags).toEqual(['new'])
    expect(after?.record.firstSeenAt).toBe(firstSeenAt)
  })
})

describe('upsertPhotosBatch', () => {
  it('writes every entry, reachable the same way as an individual upsertPhoto', () => {
    createFakeDb()
    photoRepository.upsertPhotosBatch([
      { record: makeRecord('/a.jpg', { tags: ['x'] }), mtimeMs: 100, sizeBytes: 200 },
      { record: makeRecord('/b.jpg', { tags: ['y'] }), mtimeMs: 101, sizeBytes: 201 }
    ])

    expect(photoRepository.findByPath('/a.jpg')?.record.tags).toEqual(['x'])
    expect(photoRepository.findByPath('/b.jpg')?.record.tags).toEqual(['y'])
  })

  it('is a no-op for an empty batch', () => {
    createFakeDb()
    expect(() => photoRepository.upsertPhotosBatch([])).not.toThrow()
  })
})

describe('findManyByPathPrefix', () => {
  it('returns every row under any of the given roots, keyed by path', () => {
    createFakeDb()
    photoRepository.upsertPhoto(makeRecord('/root1/a.jpg', { tags: ['x'] }), 100, 200)
    photoRepository.upsertPhoto(makeRecord('/root2/b.jpg', { tags: ['y'] }), 101, 201)
    photoRepository.upsertPhoto(makeRecord('/elsewhere/c.jpg'), 102, 202)

    const result = photoRepository.findManyByPathPrefix(['/root1', '/root2'])

    expect(Array.from(result.keys()).sort()).toEqual(['/root1/a.jpg', '/root2/b.jpg'])
    expect(result.get('/root1/a.jpg')).toMatchObject({ mtimeMs: 100, sizeBytes: 200 })
  })

  it('returns an empty map when nothing is cached under the given roots', () => {
    createFakeDb()
    expect(photoRepository.findManyByPathPrefix(['/root']).size).toBe(0)
  })
})

describe('incrementViewCount', () => {
  it('bumps the stored view count by one each call', () => {
    createFakeDb()
    photoRepository.upsertPhoto(makeRecord('/a.jpg'), 100, 200)
    photoRepository.incrementViewCount('/a.jpg')
    photoRepository.incrementViewCount('/a.jpg')
    expect(photoRepository.findByPath('/a.jpg')?.record.viewCount).toBe(2)
  })
})

describe('findPhotoPathsWithTag', () => {
  it('only returns ready, thumbnailed photos actually carrying the tag, up to the limit', () => {
    createFakeDb()
    photoRepository.upsertPhoto(
      makeRecord('/a.jpg', { tags: ['vacation'], thumbnailStatus: 'ready', thumbnailKey: 'k1' }),
      1,
      1
    )
    photoRepository.upsertPhoto(
      makeRecord('/b.jpg', { tags: ['vacation'], thumbnailStatus: 'pending' }),
      1,
      1
    )
    photoRepository.upsertPhoto(
      makeRecord('/c.jpg', { tags: ['other'], thumbnailStatus: 'ready', thumbnailKey: 'k3' }),
      1,
      1
    )

    const matches = photoRepository.findPhotoPathsWithTag('vacation', 10)
    expect(matches).toEqual([{ filePath: '/a.jpg', thumbnailKey: 'k1' }])
  })

  it('excludes photos under an excluded folder', () => {
    createFakeDb()
    mockGetExcludedFolders.mockReturnValue(['/skip'])
    photoRepository.upsertPhoto(
      makeRecord('/skip/a.jpg', { tags: ['x'], thumbnailStatus: 'ready', thumbnailKey: 'k1' }),
      1,
      1
    )
    expect(photoRepository.findPhotoPathsWithTag('x', 10)).toEqual([])
  })
})

describe('findReadyPhotosWithoutEmbeddings', () => {
  it('excludes photos that already have a cached embedding', () => {
    const { embeddedPaths } = createFakeDb()
    photoRepository.upsertPhoto(
      makeRecord('/a.jpg', { thumbnailStatus: 'ready', thumbnailKey: 'k1' }),
      1,
      1
    )
    photoRepository.upsertPhoto(
      makeRecord('/b.jpg', { thumbnailStatus: 'ready', thumbnailKey: 'k2' }),
      1,
      1
    )
    embeddedPaths.add('/a.jpg')

    expect(photoRepository.findReadyPhotosWithoutEmbeddings()).toEqual([
      { filePath: '/b.jpg', thumbnailKey: 'k2' }
    ])
  })

  it('excludes non-ready photos and photos under an excluded folder', () => {
    const { embeddedPaths } = createFakeDb()
    mockGetExcludedFolders.mockReturnValue(['/skip'])
    photoRepository.upsertPhoto(makeRecord('/pending.jpg', { thumbnailStatus: 'pending' }), 1, 1)
    photoRepository.upsertPhoto(
      makeRecord('/skip/a.jpg', { thumbnailStatus: 'ready', thumbnailKey: 'k1' }),
      1,
      1
    )

    expect(photoRepository.findReadyPhotosWithoutEmbeddings()).toEqual([])
    expect(embeddedPaths.size).toBe(0)
  })
})

describe('face scan queue', () => {
  // Regression: this used to key off "does this photo have any photo_faces
  // rows", which can't tell "scanned, no faces in it" apart from "never
  // scanned" — so every faceless photo was fully re-detected on every scan.
  it('drops a photo from the queue once it is marked scanned, even with no faces found', () => {
    createFakeDb()
    photoRepository.upsertPhoto(
      makeRecord('/a.jpg', { thumbnailStatus: 'ready', thumbnailKey: 'k1' }),
      1,
      1
    )
    photoRepository.upsertPhoto(
      makeRecord('/b.jpg', { thumbnailStatus: 'ready', thumbnailKey: 'k2' }),
      1,
      1
    )
    expect(photoRepository.findReadyPhotosWithoutFaceScan()).toHaveLength(2)

    photoRepository.markFaceScanned('/a.jpg')

    expect(photoRepository.findReadyPhotosWithoutFaceScan()).toEqual([
      { filePath: '/b.jpg', thumbnailKey: 'k2' }
    ])
  })

  it('excludes non-ready photos and photos under an excluded folder', () => {
    createFakeDb()
    mockGetExcludedFolders.mockReturnValue(['/skip'])
    photoRepository.upsertPhoto(makeRecord('/pending.jpg', { thumbnailStatus: 'pending' }), 1, 1)
    photoRepository.upsertPhoto(
      makeRecord('/skip/a.jpg', { thumbnailStatus: 'ready', thumbnailKey: 'k1' }),
      1,
      1
    )

    expect(photoRepository.findReadyPhotosWithoutFaceScan()).toEqual([])
  })

  it('clearAllFaceScanMarks re-queues everything, for a disable/re-enable reset', () => {
    createFakeDb()
    photoRepository.upsertPhoto(
      makeRecord('/a.jpg', { thumbnailStatus: 'ready', thumbnailKey: 'k1' }),
      1,
      1
    )
    photoRepository.markFaceScanned('/a.jpg')
    expect(photoRepository.findReadyPhotosWithoutFaceScan()).toEqual([])

    photoRepository.clearAllFaceScanMarks()

    expect(photoRepository.findReadyPhotosWithoutFaceScan()).toEqual([
      { filePath: '/a.jpg', thumbnailKey: 'k1' }
    ])
  })

  // A regenerated thumbnail means the pixels changed, so any earlier face
  // result for this photo is stale — same reasoning as the embedding it drops.
  // The old face rows must go with it: re-queueing detection while they're
  // still there would double up this photo's faces on the next pass.
  it('re-queues a photo whose thumbnail was regenerated, dropping its stale faces', () => {
    createFakeDb()
    photoRepository.upsertPhoto(
      makeRecord('/a.jpg', { thumbnailStatus: 'ready', thumbnailKey: 'k1' }),
      1,
      1
    )
    photoRepository.markFaceScanned('/a.jpg')

    photoRepository.updateThumbnail('/a.jpg', 'k1-new', 'ready')

    expect(photoRepository.findReadyPhotosWithoutFaceScan()).toEqual([
      { filePath: '/a.jpg', thumbnailKey: 'k1-new' }
    ])
    expect(mockDeleteEmbedding).toHaveBeenCalledWith('/a.jpg')
    expect(mockDeleteFacesForPhoto).toHaveBeenCalledWith('/a.jpg')
  })
})

describe('findAllReadyPhotos / findAllReadyPhotosWithDate', () => {
  it('only includes ready+thumbnailed photos, filtered by excluded folders', () => {
    createFakeDb()
    photoRepository.upsertPhoto(
      makeRecord('/a.jpg', { thumbnailStatus: 'ready', thumbnailKey: 'k1' }),
      1,
      1
    )
    photoRepository.upsertPhoto(makeRecord('/b.jpg', { thumbnailStatus: 'pending' }), 1, 1)
    expect(photoRepository.findAllReadyPhotos()).toEqual([
      { filePath: '/a.jpg', thumbnailKey: 'k1' }
    ])
  })

  it('findAllReadyPhotosWithDate additionally requires a dateTaken', () => {
    createFakeDb()
    photoRepository.upsertPhoto(
      makeRecord('/a.jpg', {
        thumbnailStatus: 'ready',
        thumbnailKey: 'k1',
        metadata: {
          dateTaken: '2020-01-01',
          cameraMake: null,
          cameraModel: null,
          widthPx: null,
          heightPx: null,
          fileSizeBytes: 0,
          format: 'JPEG',
          comment: null
        }
      }),
      1,
      1
    )
    photoRepository.upsertPhoto(
      makeRecord('/b.jpg', { thumbnailStatus: 'ready', thumbnailKey: 'k2' }),
      1,
      1
    )
    expect(photoRepository.findAllReadyPhotosWithDate()).toEqual([
      { filePath: '/a.jpg', thumbnailKey: 'k1', dateTaken: '2020-01-01' }
    ])
  })
})

describe('removePhoto', () => {
  it('deletes the row, returns its thumbnailKey, and cleans up embeddings/faces/tag groups', () => {
    createFakeDb()
    photoRepository.upsertPhoto(makeRecord('/a.jpg', { thumbnailKey: 'k1' }), 1, 1)

    const key = photoRepository.removePhoto('/a.jpg')

    expect(key).toBe('k1')
    expect(photoRepository.findByPath('/a.jpg')).toBeNull()
    expect(mockReconcileTagGroups).toHaveBeenCalled()
    expect(mockDeleteEmbedding).toHaveBeenCalledWith('/a.jpg')
    expect(mockDeleteFacesForPhoto).toHaveBeenCalledWith('/a.jpg')
  })

  it('returns null and does nothing for a path that was never inserted', () => {
    createFakeDb()
    expect(photoRepository.removePhoto('/missing.jpg')).toBeNull()
    expect(mockReconcileTagGroups).not.toHaveBeenCalled()
  })
})

describe('renamePhotoPathPrefix', () => {
  it('rewrites only true descendants of the folder, not a sibling sharing the same string prefix', () => {
    createFakeDb()
    photoRepository.upsertPhoto(makeRecord('/Foo/a.jpg'), 1, 1)
    photoRepository.upsertPhoto(makeRecord('/FooBar/b.jpg'), 1, 1)

    photoRepository.renamePhotoPathPrefix('/Foo', '/Renamed')

    expect(photoRepository.findByPath('/Renamed/a.jpg')).not.toBeNull()
    expect(photoRepository.findByPath('/Foo/a.jpg')).toBeNull()
    // /FooBar is a sibling, not a descendant of /Foo — must be left untouched.
    expect(photoRepository.findByPath('/FooBar/b.jpg')).not.toBeNull()
  })
})

describe('pruneMissing', () => {
  it('deletes photos under the root that are no longer in seenPaths, and cleans up their data', () => {
    createFakeDb()
    photoRepository.upsertPhoto(makeRecord('/root/a.jpg', { thumbnailKey: 'k1' }), 1, 1)
    photoRepository.upsertPhoto(makeRecord('/root/b.jpg', { thumbnailKey: 'k2' }), 1, 1)

    const removedKeys = photoRepository.pruneMissing('/root', new Set(['/root/a.jpg']))

    expect(removedKeys).toEqual(['k2'])
    expect(photoRepository.findByPath('/root/a.jpg')).not.toBeNull()
    expect(photoRepository.findByPath('/root/b.jpg')).toBeNull()
    expect(mockReconcileTagGroups).toHaveBeenCalled()
    expect(mockDeleteFacesForPhoto).toHaveBeenCalledWith('/root/b.jpg')
  })

  it('returns an empty array and skips cleanup when nothing is stale', () => {
    createFakeDb()
    photoRepository.upsertPhoto(makeRecord('/root/a.jpg'), 1, 1)
    expect(photoRepository.pruneMissing('/root', new Set(['/root/a.jpg']))).toEqual([])
    expect(mockReconcileTagGroups).not.toHaveBeenCalled()
  })
})
