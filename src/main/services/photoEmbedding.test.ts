// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetEmbedding,
  mockSetEmbedding,
  mockFindAllReadyPhotos,
  mockPhotoExists,
  mockEmbedImage,
  mockThumbnailFilePath,
  mockGenerateThumbnail,
  mockAccess
} = vi.hoisted(() => ({
  mockGetEmbedding: vi.fn(),
  mockSetEmbedding: vi.fn(),
  mockFindAllReadyPhotos: vi.fn(),
  mockPhotoExists: vi.fn(),
  mockEmbedImage: vi.fn(),
  mockThumbnailFilePath: vi.fn(),
  mockGenerateThumbnail: vi.fn(),
  mockAccess: vi.fn()
}))

vi.mock('@main/db/embeddingRepository', () => ({
  getEmbedding: mockGetEmbedding,
  setEmbedding: mockSetEmbedding
}))
vi.mock('@main/db/photoRepository', () => ({
  findAllReadyPhotos: mockFindAllReadyPhotos,
  photoExists: mockPhotoExists
}))
vi.mock('./tagSuggestionService', () => ({ embedImage: mockEmbedImage }))
vi.mock('./thumbnailService', () => ({
  thumbnailFilePath: mockThumbnailFilePath,
  generateThumbnail: mockGenerateThumbnail
}))
vi.mock('fs/promises', () => ({ access: mockAccess }))

import { embedAllReadyPhotos } from './photoEmbedding'

function makePhotos(paths: string[]): { filePath: string; thumbnailKey: string }[] {
  return paths.map((filePath) => ({ filePath, thumbnailKey: `${filePath}-key` }))
}

describe('embedAllReadyPhotos', () => {
  beforeEach(() => {
    mockGetEmbedding.mockReset().mockReturnValue(null)
    mockSetEmbedding.mockReset()
    mockFindAllReadyPhotos.mockReset()
    mockPhotoExists.mockReset().mockReturnValue(true)
    mockEmbedImage.mockReset().mockResolvedValue([1, 0])
    mockThumbnailFilePath.mockReset().mockImplementation((key: string) => `/thumbs/${key}`)
    mockGenerateThumbnail.mockReset().mockResolvedValue(undefined)
    mockAccess.mockReset().mockResolvedValue(undefined)
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

  it('regenerates a missing thumbnail file before embedding, rather than failing', async () => {
    mockFindAllReadyPhotos.mockReturnValue(makePhotos(['/a.jpg']))
    mockAccess.mockRejectedValue(new Error('ENOENT'))

    await embedAllReadyPhotos()

    expect(mockGenerateThumbnail).toHaveBeenCalledExactlyOnceWith('/a.jpg', '/a.jpg-key')
    expect(mockEmbedImage).toHaveBeenCalledExactlyOnceWith('/thumbs//a.jpg-key')
  })

  it('skips a photo that fails to embed instead of aborting the whole scan', async () => {
    mockFindAllReadyPhotos.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg', '/c.jpg']))
    mockEmbedImage.mockImplementation((path: string) =>
      path.includes('/b.jpg') ? Promise.reject(new Error('corrupt image')) : Promise.resolve([1, 0])
    )

    const results = await embedAllReadyPhotos()

    expect(results.map((r) => r.filePath)).toEqual(['/a.jpg', '/c.jpg'])
  })

  // Regression: a folder removed mid-scan deletes its photos rows via
  // pruneMissing, but this function's own photo list is a snapshot taken
  // before that — without re-checking, it would still read the (still
  // on-disk) file and write a fresh, orphaned embedding for a path no
  // longer in the photos table.
  it('skips a photo that no longer exists (its folder was removed mid-scan)', async () => {
    mockFindAllReadyPhotos.mockReturnValue(makePhotos(['/a.jpg', '/removed/b.jpg', '/c.jpg']))
    mockPhotoExists.mockImplementation((path: string) => path !== '/removed/b.jpg')
    const onProgress = vi.fn()

    const results = await embedAllReadyPhotos(onProgress)

    expect(results.map((r) => r.filePath)).toEqual(['/a.jpg', '/c.jpg'])
    expect(mockEmbedImage).not.toHaveBeenCalledWith(expect.stringContaining('removed'))
    expect(mockSetEmbedding).not.toHaveBeenCalledWith('/removed/b.jpg', expect.anything())
    // Progress still reaches the true total — loop position, not work done.
    expect(onProgress).toHaveBeenLastCalledWith(3, 3)
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
