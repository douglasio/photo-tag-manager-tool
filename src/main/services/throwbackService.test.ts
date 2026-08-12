// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAllEmbeddings, mockFindAllReadyPhotosWithDate, workerTracker } = vi.hoisted(() => {
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
    mockFindAllReadyPhotosWithDate: vi.fn(),
    workerTracker: { current: null as InstanceType<typeof FakeWorker> | null, FakeWorker }
  }
})

vi.mock('@main/db/embeddingRepository', () => ({ getAllEmbeddings: mockGetAllEmbeddings }))
vi.mock('@main/db/photoRepository', () => ({
  findAllReadyPhotosWithDate: mockFindAllReadyPhotosWithDate
}))
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
  disposeThrowbackSimilarityWorker,
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
  beforeEach(async () => {
    await disposeThrowbackSimilarityWorker()
    workerTracker.current = null
    mockGetAllEmbeddings.mockReset()
    mockFindAllReadyPhotosWithDate.mockReset()
  })

  it('returns null without spawning a worker when fewer than 2 cached-and-dated photos exist', async () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([makeRawPhoto('/a.jpg', 2020)])
    mockGetAllEmbeddings.mockReturnValue([{ filePath: '/a.jpg', embedding: [1, 0] }])

    expect(await findThrowbackSimilarity()).toBeNull()
    expect(workerTracker.current).toBeNull()
  })

  it('sends only cached-and-dated photos to the worker, joined with their year', async () => {
    // /undated.jpg has an embedding but never shows up in
    // findAllReadyPhotosWithDate (no dateTaken) — should be excluded, not
    // sent to the worker at all.
    mockFindAllReadyPhotosWithDate.mockReturnValue([
      makeRawPhoto('/2020.jpg', 2020),
      makeRawPhoto('/2021.jpg', 2021)
    ])
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/2020.jpg', embedding: [1, 0] },
      { filePath: '/2021.jpg', embedding: [0, 1] },
      { filePath: '/undated.jpg', embedding: [1, 0] }
    ])

    const promise = findThrowbackSimilarity()
    const computeMessage = workerTracker.current!.posted.find((m) => m.type === 'compute')

    expect(computeMessage).toMatchObject({
      type: 'compute',
      photos: [
        { filePath: '/2020.jpg', embedding: [1, 0], year: 2020 },
        { filePath: '/2021.jpg', embedding: [0, 1], year: 2021 }
      ]
    })

    workerTracker.current!.emit('message', {
      type: 'result',
      requestId: computeMessage!.requestId,
      entries: null
    })
    await promise
  })

  it('resolves with whatever the worker returns', async () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([
      makeRawPhoto('/2019.jpg', 2019),
      makeRawPhoto('/2022.jpg', 2022)
    ])
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/2019.jpg', embedding: [1, 0] },
      { filePath: '/2022.jpg', embedding: [0, 1] }
    ])
    const entries = [
      { year: 2019, filePath: '/2019.jpg' },
      { year: 2022, filePath: '/2022.jpg' }
    ]

    const promise = findThrowbackSimilarity()
    const computeMessage = workerTracker.current!.posted.find((m) => m.type === 'compute')
    workerTracker.current!.emit('message', {
      type: 'result',
      requestId: computeMessage!.requestId,
      entries
    })

    await expect(promise).resolves.toEqual(entries)
  })

  it('rejects when the worker reports an error', async () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([
      makeRawPhoto('/a.jpg', 2020),
      makeRawPhoto('/b.jpg', 2021)
    ])
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/a.jpg', embedding: [1, 0] },
      { filePath: '/b.jpg', embedding: [0, 1] }
    ])

    const promise = findThrowbackSimilarity()
    const computeMessage = workerTracker.current!.posted.find((m) => m.type === 'compute')
    workerTracker.current!.emit('message', {
      type: 'error',
      requestId: computeMessage!.requestId,
      message: 'compute failed'
    })

    await expect(promise).rejects.toThrow('compute failed')
  })

  it('disposeThrowbackSimilarityWorker terminates the worker and rejects pending requests', async () => {
    mockFindAllReadyPhotosWithDate.mockReturnValue([
      makeRawPhoto('/a.jpg', 2020),
      makeRawPhoto('/b.jpg', 2021)
    ])
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/a.jpg', embedding: [1, 0] },
      { filePath: '/b.jpg', embedding: [0, 1] }
    ])

    const promise = findThrowbackSimilarity()
    const worker = workerTracker.current!

    await disposeThrowbackSimilarityWorker()

    expect(worker.terminate).toHaveBeenCalledOnce()
    await expect(promise).rejects.toThrow()
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
