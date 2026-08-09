// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { clusterByEmbeddingSimilarity } from './duplicateClustering'

const THRESHOLD = 0.97

describe('clusterByEmbeddingSimilarity', () => {
  it('groups photos whose embeddings are near-identical', async () => {
    const { groups, canceled } = await clusterByEmbeddingSimilarity(
      [
        { filePath: '/a.jpg', embedding: [1, 0] },
        { filePath: '/b.jpg', embedding: [1, 0] },
        { filePath: '/c.jpg', embedding: [0, 1] }
      ],
      THRESHOLD
    )

    expect(canceled).toBe(false)
    expect(groups).toHaveLength(1)
    expect(groups[0].filePaths).toEqual(['/a.jpg', '/b.jpg'])
    expect(groups[0].similarity).toBeCloseTo(1)
  })

  it('chains transitively-linked duplicates into one group', async () => {
    // a~b close, b~c close, a~c not directly close enough on their own —
    // still one group via the union-find transitive link through b.
    const { groups } = await clusterByEmbeddingSimilarity(
      [
        { filePath: '/a.jpg', embedding: [1, 0] },
        { filePath: '/b.jpg', embedding: [0.985, Math.sqrt(1 - 0.985 ** 2)] },
        { filePath: '/c.jpg', embedding: [0.97, Math.sqrt(1 - 0.97 ** 2)] }
      ],
      THRESHOLD
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].filePaths).toEqual(expect.arrayContaining(['/a.jpg', '/b.jpg', '/c.jpg']))
  })

  it('omits photos with no duplicates', async () => {
    const { groups } = await clusterByEmbeddingSimilarity(
      [
        { filePath: '/a.jpg', embedding: [1, 0] },
        { filePath: '/b.jpg', embedding: [0, 1] }
      ],
      THRESHOLD
    )

    expect(groups).toEqual([])
  })

  it('reports progress via the onProgress callback', async () => {
    const onProgress = vi.fn()
    await clusterByEmbeddingSimilarity(
      [
        { filePath: '/a.jpg', embedding: [1, 0] },
        { filePath: '/b.jpg', embedding: [0, 1] }
      ],
      THRESHOLD,
      onProgress
    )

    // Only 1 pair total (below the 20,000 yield cadence), so progress is
    // only ever reported once, at the end, with the full pair count.
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(1, 1)
  })

  it('throttles onProgress instead of firing at every yield point, but still reports the final tally', async () => {
    // 450 photos -> ~101k pairs -> crosses the 20,000-comparison yield
    // cadence 5 times before finishing, but each crossing happens well
    // under the 150ms progress-throttle window in a synchronous test run.
    const photos = Array.from({ length: 450 }, (_, i) => ({
      filePath: `/${i}.jpg`,
      embedding: [Math.cos(i), Math.sin(i)]
    }))
    const onProgress = vi.fn()

    await clusterByEmbeddingSimilarity(photos, THRESHOLD, onProgress)

    // Unthrottled, this would be 5 mid-loop calls plus 1 final call = 6.
    expect(onProgress.mock.calls.length).toBeLessThan(6)
    const totalPairs = (450 * 449) / 2
    expect(onProgress).toHaveBeenLastCalledWith(totalPairs, totalPairs)
  })

  it('stops early and returns no groups once isCancelled flips true', async () => {
    // Cancellation is only checked every 20,000 comparisons, so this needs
    // enough photos to actually cross that boundary (200 photos = 19,900
    // pairs — not quite enough on its own, so 201 to clear it at 20,100).
    const photos = Array.from({ length: 201 }, (_, i) => ({
      filePath: `/${i}.jpg`,
      embedding: [Math.cos(i), Math.sin(i)]
    }))

    const { groups, canceled } = await clusterByEmbeddingSimilarity(
      photos,
      THRESHOLD,
      undefined,
      () => true
    )

    expect(canceled).toBe(true)
    expect(groups).toEqual([])
  })
})
