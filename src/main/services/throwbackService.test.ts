// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAllEmbeddings, mockFindAllReadyPhotosWithDate } = vi.hoisted(() => ({
  mockGetAllEmbeddings: vi.fn(),
  mockFindAllReadyPhotosWithDate: vi.fn()
}))

vi.mock('@main/db/embeddingRepository', () => ({ getAllEmbeddings: mockGetAllEmbeddings }))
vi.mock('@main/db/photoRepository', () => ({
  findAllReadyPhotosWithDate: mockFindAllReadyPhotosWithDate
}))

import {
  findThrowbackPreview,
  findThrowbackSimilarity,
  findThrowbackYearSample
} from './throwbackService'

interface RawPhoto {
  filePath: string
  thumbnailKey: string
  dateTaken: string
}

function makeRawPhoto(filePath: string, year: number): RawPhoto {
  return { filePath, thumbnailKey: `${filePath}-key`, dateTaken: `${year}-06-15T12:00:00.000Z` }
}

describe('findThrowbackSimilarity', () => {
  beforeEach(() => {
    mockGetAllEmbeddings.mockReset()
    mockFindAllReadyPhotosWithDate.mockReset()
  })

  it('returns null when fewer than 2 cached-and-dated photos exist', async () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([makeRawPhoto('/a.jpg', 2020)])
    mockGetAllEmbeddings.mockReturnValue([{ filePath: '/a.jpg', embedding: [1, 0] }])

    expect(await findThrowbackSimilarity()).toBeNull()
  })

  it('returns null when no cross-year pair clears the similarity threshold', async () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([
      makeRawPhoto('/a.jpg', 2020),
      makeRawPhoto('/b.jpg', 2021)
    ])
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/a.jpg', embedding: [1, 0] },
      { filePath: '/b.jpg', embedding: [0, 1] }
    ])

    expect(await findThrowbackSimilarity()).toBeNull()
  })

  it('pairs similar photos from different years, sorted oldest first', async () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([
      makeRawPhoto('/2019.jpg', 2019),
      makeRawPhoto('/2022.jpg', 2022)
    ])
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/2022.jpg', embedding: [1, 0] },
      { filePath: '/2019.jpg', embedding: [0.9, Math.sqrt(1 - 0.9 ** 2)] }
    ])

    const result = await findThrowbackSimilarity()

    expect(result).toEqual([
      { year: 2019, filePath: '/2019.jpg' },
      { year: 2022, filePath: '/2022.jpg' }
    ])
  })

  it('never links two photos from the same year, even if visually near-identical', async () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([
      makeRawPhoto('/2020-a.jpg', 2020),
      makeRawPhoto('/2020-b.jpg', 2020)
    ])
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/2020-a.jpg', embedding: [1, 0] },
      { filePath: '/2020-b.jpg', embedding: [1, 0] }
    ])

    expect(await findThrowbackSimilarity()).toBeNull()
  })

  it('ignores cached embeddings for photos with no known dateTaken', async () => {
    // /undated.jpg has an embedding but never shows up in
    // findAllReadyPhotosWithDate (no dateTaken) — should be excluded, not
    // crash on a missing year lookup.
    mockFindAllReadyPhotosWithDate.mockReturnValue([makeRawPhoto('/2020.jpg', 2020)])
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/2020.jpg', embedding: [1, 0] },
      { filePath: '/undated.jpg', embedding: [1, 0] }
    ])

    expect(await findThrowbackSimilarity()).toBeNull()
  })

  it('picks the cluster spanning the most distinct years when multiple qualify', async () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([
      makeRawPhoto('/2018.jpg', 2018),
      makeRawPhoto('/2019.jpg', 2019),
      makeRawPhoto('/2020.jpg', 2020),
      makeRawPhoto('/x1.jpg', 2021),
      makeRawPhoto('/x2.jpg', 2022)
    ])
    mockGetAllEmbeddings.mockReturnValue([
      // A 3-year cluster around [1, 0]...
      { filePath: '/2018.jpg', embedding: [1, 0] },
      { filePath: '/2019.jpg', embedding: [1, 0] },
      { filePath: '/2020.jpg', embedding: [1, 0] },
      // ...vs. a 2-year cluster around [0, 1].
      { filePath: '/x1.jpg', embedding: [0, 1] },
      { filePath: '/x2.jpg', embedding: [0, 1] }
    ])

    const result = await findThrowbackSimilarity()

    expect(result?.map((entry) => entry.year)).toEqual([2018, 2019, 2020])
  })
})

describe('findThrowbackYearSample', () => {
  const REAL_DATE_NOW = Date.now

  beforeEach(() => {
    mockFindAllReadyPhotosWithDate.mockReset()
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01').getTime())
  })

  afterEach(() => {
    Date.now = REAL_DATE_NOW
  })

  it('returns null when no past year has enough photos', () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([
      makeRawPhoto('/a.jpg', 2020),
      makeRawPhoto('/b.jpg', 2020)
    ])

    expect(findThrowbackYearSample()).toBeNull()
  })

  it('excludes the current year even if it has enough photos', () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue(
      Array.from({ length: 5 }, (_, i) => makeRawPhoto(`/${i}.jpg`, 2026))
    )

    expect(findThrowbackYearSample()).toBeNull()
  })

  it('samples up to 4 photos from a qualifying past year', () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue(
      Array.from({ length: 6 }, (_, i) => makeRawPhoto(`/${i}.jpg`, 2020))
    )

    const result = findThrowbackYearSample()

    expect(result?.year).toBe(2020)
    expect(result?.filePaths).toHaveLength(4)
  })
})

describe('findThrowbackPreview', () => {
  beforeEach(() => {
    mockFindAllReadyPhotosWithDate.mockReset()
  })

  it('returns null when fewer than 2 distinct years are present', () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([makeRawPhoto('/a.jpg', 2020)])

    expect(findThrowbackPreview()).toBeNull()
  })

  it('returns one random entry per distinct year, sorted oldest first', () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([
      makeRawPhoto('/2022.jpg', 2022),
      makeRawPhoto('/2019.jpg', 2019),
      makeRawPhoto('/2020-a.jpg', 2020),
      makeRawPhoto('/2020-b.jpg', 2020)
    ])

    const result = findThrowbackPreview()

    expect(result?.map((entry) => entry.year)).toEqual([2019, 2020, 2022])
  })
})
