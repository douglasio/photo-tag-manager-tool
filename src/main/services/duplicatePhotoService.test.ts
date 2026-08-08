// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAllEmbeddings, mockFindAllReadyPhotos, mockGetOrComputeEmbedding } = vi.hoisted(
  () => ({
    mockGetAllEmbeddings: vi.fn(),
    mockFindAllReadyPhotos: vi.fn(),
    mockGetOrComputeEmbedding: vi.fn()
  })
)

vi.mock('@main/db/embeddingRepository', () => ({ getAllEmbeddings: mockGetAllEmbeddings }))
vi.mock('@main/db/photoRepository', () => ({ findAllReadyPhotos: mockFindAllReadyPhotos }))
vi.mock('./photoEmbedding', () => ({ getOrComputeEmbedding: mockGetOrComputeEmbedding }))

import { findDuplicateGroups, findSimilarPhotos } from './duplicatePhotoService'

function makePhotos(paths: string[]): { filePath: string; thumbnailKey: string }[] {
  return paths.map((filePath) => ({ filePath, thumbnailKey: `${filePath}-key` }))
}

describe('findDuplicateGroups', () => {
  beforeEach(() => {
    mockFindAllReadyPhotos.mockReset()
    mockGetOrComputeEmbedding.mockReset()
  })

  it('groups photos whose embeddings are near-identical', async () => {
    mockFindAllReadyPhotos.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg', '/c.jpg']))
    mockGetOrComputeEmbedding
      .mockResolvedValueOnce([1, 0])
      .mockResolvedValueOnce([1, 0])
      .mockResolvedValueOnce([0, 1])

    const groups = await findDuplicateGroups()

    expect(groups).toHaveLength(1)
    expect(groups[0].filePaths).toEqual(['/a.jpg', '/b.jpg'])
    expect(groups[0].similarity).toBeCloseTo(1)
  })

  it('chains transitively-linked duplicates into one group', async () => {
    mockFindAllReadyPhotos.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg', '/c.jpg']))
    // a~b close, b~c close, a~c not directly close enough on their own —
    // still one group via the union-find transitive link through b.
    mockGetOrComputeEmbedding
      .mockResolvedValueOnce([1, 0])
      .mockResolvedValueOnce([0.985, Math.sqrt(1 - 0.985 ** 2)])
      .mockResolvedValueOnce([0.97, Math.sqrt(1 - 0.97 ** 2)])

    const groups = await findDuplicateGroups()

    expect(groups).toHaveLength(1)
    expect(groups[0].filePaths).toEqual(expect.arrayContaining(['/a.jpg', '/b.jpg', '/c.jpg']))
  })

  it('omits photos with no duplicates', async () => {
    mockFindAllReadyPhotos.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg']))
    mockGetOrComputeEmbedding.mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, 1])

    const groups = await findDuplicateGroups()

    expect(groups).toEqual([])
  })

  it('reports embedding progress for each photo', async () => {
    mockFindAllReadyPhotos.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg']))
    mockGetOrComputeEmbedding.mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, 1])
    const onProgress = vi.fn()

    await findDuplicateGroups(onProgress)

    expect(onProgress).toHaveBeenCalledWith({ phase: 'embedding', done: 1, total: 2 })
    expect(onProgress).toHaveBeenCalledWith({ phase: 'embedding', done: 2, total: 2 })
  })
})

describe('findSimilarPhotos', () => {
  beforeEach(() => {
    mockGetAllEmbeddings.mockReset()
    mockGetOrComputeEmbedding.mockReset()
  })

  it('returns only matches at or above the duplicate threshold, sorted by score', async () => {
    mockGetOrComputeEmbedding.mockResolvedValue([1, 0])
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/close.jpg', embedding: new Float32Array([0.98, Math.sqrt(1 - 0.98 ** 2)]) },
      { filePath: '/far.jpg', embedding: new Float32Array([0, 1]) }
    ])

    const results = await findSimilarPhotos('/target.jpg', 'target-key', 5)

    expect(results.map((r) => r.filePath)).toEqual(['/close.jpg'])
  })

  it('excludes the target photo itself from its own results', async () => {
    mockGetOrComputeEmbedding.mockResolvedValue([1, 0])
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/target.jpg', embedding: new Float32Array([1, 0]) }
    ])

    const results = await findSimilarPhotos('/target.jpg', 'target-key', 5)

    expect(results).toEqual([])
  })

  it('caps results at the given limit', async () => {
    mockGetOrComputeEmbedding.mockResolvedValue([1, 0])
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/a.jpg', embedding: new Float32Array([1, 0]) },
      { filePath: '/b.jpg', embedding: new Float32Array([1, 0]) },
      { filePath: '/c.jpg', embedding: new Float32Array([1, 0]) }
    ])

    const results = await findSimilarPhotos('/target.jpg', 'target-key', 2)

    expect(results).toHaveLength(2)
  })
})
