// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetEmbedding,
  mockSetEmbedding,
  mockFindAllReadyPhotos,
  mockEmbedImage,
  mockThumbnailFilePath
} = vi.hoisted(() => ({
  mockGetEmbedding: vi.fn(),
  mockSetEmbedding: vi.fn(),
  mockFindAllReadyPhotos: vi.fn(),
  mockEmbedImage: vi.fn(),
  mockThumbnailFilePath: vi.fn()
}))

vi.mock('@main/db/embeddingRepository', () => ({
  getEmbedding: mockGetEmbedding,
  setEmbedding: mockSetEmbedding
}))
vi.mock('@main/db/photoRepository', () => ({ findAllReadyPhotos: mockFindAllReadyPhotos }))
vi.mock('./tagSuggestionService', () => ({ embedImage: mockEmbedImage }))
vi.mock('./thumbnailService', () => ({ thumbnailFilePath: mockThumbnailFilePath }))

import { embedAllReadyPhotos } from './photoEmbedding'

function makePhotos(paths: string[]): { filePath: string; thumbnailKey: string }[] {
  return paths.map((filePath) => ({ filePath, thumbnailKey: `${filePath}-key` }))
}

describe('embedAllReadyPhotos', () => {
  beforeEach(() => {
    mockGetEmbedding.mockReset().mockReturnValue(null)
    mockSetEmbedding.mockReset()
    mockFindAllReadyPhotos.mockReset()
    mockEmbedImage.mockReset().mockResolvedValue([1, 0])
    mockThumbnailFilePath.mockReset().mockImplementation((key: string) => `/thumbs/${key}`)
  })

  it('embeds and caches every ready photo, reporting progress as it goes', async () => {
    mockFindAllReadyPhotos.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg']))
    const onProgress = vi.fn()

    const results = await embedAllReadyPhotos(onProgress)

    expect(results.map((r) => r.filePath)).toEqual(['/a.jpg', '/b.jpg'])
    expect(mockSetEmbedding).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2)
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2)
  })

  it('throttles progress on a fast run, but always reports the final tally', async () => {
    mockFindAllReadyPhotos.mockReturnValue(
      makePhotos(['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg', '/e.jpg'])
    )
    const onProgress = vi.fn()

    await embedAllReadyPhotos(onProgress)

    // Unthrottled, this would fire once per photo (5 times); each mocked
    // embed resolves near-instantly, well under the progress-throttle
    // window, so the in-between ticks collapse away.
    expect(onProgress.mock.calls.length).toBeLessThan(5)
    expect(onProgress).toHaveBeenLastCalledWith(5, 5)
  })

  it('reuses an already-cached embedding instead of re-embedding', async () => {
    mockFindAllReadyPhotos.mockReturnValue(makePhotos(['/a.jpg']))
    mockGetEmbedding.mockReturnValue(new Float32Array([1, 0]))

    await embedAllReadyPhotos()

    expect(mockEmbedImage).not.toHaveBeenCalled()
  })

  it('stops early once isCancelled reports true, without discarding already-embedded results', async () => {
    mockFindAllReadyPhotos.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg', '/c.jpg']))
    let calls = 0
    const isCancelled = (): boolean => {
      calls++
      return calls > 1
    }

    const results = await embedAllReadyPhotos(undefined, isCancelled)

    expect(results.map((r) => r.filePath)).toEqual(['/a.jpg'])
    expect(mockEmbedImage).toHaveBeenCalledTimes(1)
  })
})
