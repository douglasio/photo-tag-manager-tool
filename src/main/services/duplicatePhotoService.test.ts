// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAllEmbeddings, mockGetOrComputeEmbedding, workerTracker } = vi.hoisted(() => {
  // require, not the top-level `import`, since vi.hoisted's callback runs
  // before even non-mocked imports are evaluated.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('node:events')
  class FakeWorker extends EventEmitter {
    posted: { type: string; requestId?: number }[] = []
    terminate = vi.fn().mockResolvedValue(undefined)
    postMessage(message: { type: string; requestId?: number }): void {
      this.posted.push(message)
    }
  }
  return {
    mockGetAllEmbeddings: vi.fn(),
    mockGetOrComputeEmbedding: vi.fn(),
    workerTracker: { current: null as InstanceType<typeof FakeWorker> | null, FakeWorker }
  }
})

vi.mock('@main/db/embeddingRepository', () => ({ getAllEmbeddings: mockGetAllEmbeddings }))
vi.mock('./photoEmbedding', () => ({ getOrComputeEmbedding: mockGetOrComputeEmbedding }))
vi.mock('worker_threads', () => ({
  // A regular function, not an arrow function — vi.fn()'s mock
  // implementation is invoked with `new`, which arrow functions can't be.
  Worker: vi.fn().mockImplementation(function (this: unknown) {
    const worker = new workerTracker.FakeWorker()
    workerTracker.current = worker
    return worker
  })
}))

import {
  clusterDuplicates,
  disposeDuplicateClusterWorker,
  findSimilarPhotos
} from './duplicatePhotoService'

function makeEmbedded(
  entries: [string, number[]][]
): { filePath: string; thumbnailKey: string; embedding: number[] }[] {
  return entries.map(([filePath, embedding]) => ({
    filePath,
    thumbnailKey: `${filePath}-key`,
    embedding
  }))
}

describe('clusterDuplicates', () => {
  beforeEach(async () => {
    await disposeDuplicateClusterWorker()
    workerTracker.current = null
  })

  it('sends a cluster request to the worker and resolves with its result', async () => {
    const photos = makeEmbedded([
      ['/a.jpg', [1, 0]],
      ['/b.jpg', [1, 0]]
    ])
    const promise = clusterDuplicates(photos)

    const clusterMessage = workerTracker.current!.posted.find((m) => m.type === 'cluster')
    expect(clusterMessage).toMatchObject({ type: 'cluster' })

    workerTracker.current!.emit('message', {
      type: 'result',
      requestId: clusterMessage!.requestId,
      groups: [{ filePaths: ['/a.jpg', '/b.jpg'], similarity: 1 }],
      canceled: false
    })

    await expect(promise).resolves.toEqual({
      groups: [{ filePaths: ['/a.jpg', '/b.jpg'], similarity: 1 }],
      canceled: false
    })
  })

  it('forwards progress messages to the onProgress callback', async () => {
    const onProgress = vi.fn()
    const promise = clusterDuplicates(makeEmbedded([['/a.jpg', [1, 0]]]), onProgress)
    const clusterMessage = workerTracker.current!.posted.find((m) => m.type === 'cluster')

    workerTracker.current!.emit('message', {
      type: 'progress',
      requestId: clusterMessage!.requestId,
      comparisons: 20000,
      totalPairs: 40000
    })
    expect(onProgress).toHaveBeenCalledWith(20000, 40000)

    workerTracker.current!.emit('message', {
      type: 'result',
      requestId: clusterMessage!.requestId,
      groups: [],
      canceled: false
    })
    await promise
  })

  it('rejects when the worker reports an error', async () => {
    const promise = clusterDuplicates(makeEmbedded([['/a.jpg', [1, 0]]]))
    const clusterMessage = workerTracker.current!.posted.find((m) => m.type === 'cluster')

    workerTracker.current!.emit('message', {
      type: 'error',
      requestId: clusterMessage!.requestId,
      message: 'clustering failed'
    })

    await expect(promise).rejects.toThrow('clustering failed')
  })

  it('forwards a cancel message once isCancelled flips true', async () => {
    vi.useFakeTimers()
    let cancelled = false
    const promise = clusterDuplicates(
      makeEmbedded([['/a.jpg', [1, 0]]]),
      undefined,
      () => cancelled
    )
    const clusterMessage = workerTracker.current!.posted.find((m) => m.type === 'cluster')

    cancelled = true
    await vi.advanceTimersByTimeAsync(200)

    expect(workerTracker.current!.posted).toContainEqual({
      type: 'cancel',
      requestId: clusterMessage!.requestId
    })

    workerTracker.current!.emit('message', {
      type: 'result',
      requestId: clusterMessage!.requestId,
      groups: [],
      canceled: true
    })
    await expect(promise).resolves.toEqual({ groups: [], canceled: true })
    vi.useRealTimers()
  })

  it('disposeDuplicateClusterWorker terminates the worker and rejects pending requests', async () => {
    const promise = clusterDuplicates(makeEmbedded([['/a.jpg', [1, 0]]]))
    const worker = workerTracker.current!

    await disposeDuplicateClusterWorker()

    expect(worker.terminate).toHaveBeenCalledOnce()
    await expect(promise).rejects.toThrow()
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
