// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetEmbedding,
  mockSetEmbedding,
  mockFindPhotoPathsWithTag,
  mockEmbedImage,
  mockThumbnailFilePath
} = vi.hoisted(() => ({
  mockGetEmbedding: vi.fn(),
  mockSetEmbedding: vi.fn(),
  mockFindPhotoPathsWithTag: vi.fn(),
  mockEmbedImage: vi.fn(),
  mockThumbnailFilePath: vi.fn()
}))

vi.mock('@main/db/embeddingRepository', () => ({
  getEmbedding: mockGetEmbedding,
  setEmbedding: mockSetEmbedding
}))
vi.mock('@main/db/photoRepository', () => ({
  findPhotoPathsWithTag: mockFindPhotoPathsWithTag
}))
vi.mock('./tagSuggestionService', () => ({ embedImage: mockEmbedImage }))
vi.mock('./thumbnailService', () => ({ thumbnailFilePath: mockThumbnailFilePath }))

import { suggestTagsByExemplar } from './tagExemplarService'

function makeExamples(paths: string[]): { filePath: string; thumbnailKey: string }[] {
  return paths.map((filePath) => ({ filePath, thumbnailKey: `${filePath}-key` }))
}

describe('suggestTagsByExemplar', () => {
  beforeEach(() => {
    mockGetEmbedding.mockReset().mockReturnValue(null)
    mockSetEmbedding.mockReset()
    mockFindPhotoPathsWithTag.mockReset()
    mockEmbedImage.mockReset()
    mockThumbnailFilePath.mockReset().mockImplementation((key: string) => `/thumbs/${key}`)
  })

  it('omits tags with fewer than the minimum number of tagged examples', async () => {
    mockFindPhotoPathsWithTag.mockReturnValue(makeExamples(['/a.jpg', '/b.jpg']))
    mockEmbedImage.mockResolvedValue([1, 0])

    const results = await suggestTagsByExemplar('/new.jpg', 'new-key', ['sparse-tag'])

    expect(results).toEqual([])
  })

  it('scores a tag by cosine similarity to its examples’ average embedding', async () => {
    mockFindPhotoPathsWithTag.mockReturnValue(makeExamples(['/a.jpg', '/b.jpg', '/c.jpg']))
    // Target embedding, then one per example (in call order: target first).
    mockEmbedImage
      .mockResolvedValueOnce([1, 0])
      .mockResolvedValueOnce([1, 0])
      .mockResolvedValueOnce([1, 0])
      .mockResolvedValueOnce([1, 0])

    const results = await suggestTagsByExemplar('/new.jpg', 'new-key', ['vacation'])

    expect(results).toEqual([{ tag: 'vacation', score: 1 }])
  })

  it('ranks multiple eligible tags by descending similarity', async () => {
    mockFindPhotoPathsWithTag.mockImplementation((tag: string) =>
      makeExamples([`/${tag}-a.jpg`, `/${tag}-b.jpg`, `/${tag}-c.jpg`])
    )
    mockEmbedImage.mockImplementation((imagePath: string) => {
      if (imagePath === '/thumbs/target-key') return Promise.resolve([1, 0])
      if (imagePath.includes('close')) return Promise.resolve([0.9, 0.1])
      return Promise.resolve([0, 1])
    })

    const results = await suggestTagsByExemplar('/new.jpg', 'target-key', ['close', 'far'])

    expect(results.map((r) => r.tag)).toEqual(['close', 'far'])
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it('reuses a cached embedding instead of re-embedding', async () => {
    mockGetEmbedding.mockImplementation((filePath: string) =>
      filePath === '/new.jpg' ? new Float32Array([1, 0]) : null
    )
    mockFindPhotoPathsWithTag.mockReturnValue(makeExamples(['/a.jpg', '/b.jpg', '/c.jpg']))
    mockEmbedImage.mockResolvedValue([1, 0])

    await suggestTagsByExemplar('/new.jpg', 'target-key', ['vacation'])

    // Only the 3 examples got embedded — the target's cached embedding was reused.
    expect(mockEmbedImage).toHaveBeenCalledTimes(3)
    expect(mockSetEmbedding).not.toHaveBeenCalledWith('/new.jpg', expect.anything())
  })

  it('caches a freshly computed embedding for reuse next time', async () => {
    mockFindPhotoPathsWithTag.mockReturnValue([])
    mockEmbedImage.mockResolvedValue([1, 0])

    await suggestTagsByExemplar('/new.jpg', 'target-key', [])

    expect(mockSetEmbedding).toHaveBeenCalledExactlyOnceWith('/new.jpg', new Float32Array([1, 0]))
  })
})
