// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetPath, workerTracker } = vi.hoisted(() => {
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
    mockGetPath: vi.fn().mockReturnValue('/tmp/userData'),
    workerTracker: { current: null as InstanceType<typeof FakeWorker> | null, FakeWorker }
  }
})

vi.mock('electron', () => ({ app: { getPath: mockGetPath } }))
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
  disposeTagSuggestionWorker,
  embedImage,
  ensureModelReady,
  suggestTags
} from './tagSuggestionService'

// Lets pending .then/.catch continuations run before the next assertion.
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

describe('tagSuggestionService', () => {
  beforeEach(async () => {
    await disposeTagSuggestionWorker()
    workerTracker.current = null
  })

  it('spawns the worker and sends init when ensureModelReady is first called', () => {
    // Never resolved in this test — the next test's beforeEach disposal
    // rejects it, so swallow that here rather than leave it unhandled.
    void ensureModelReady().catch(() => undefined)

    expect(workerTracker.current).not.toBeNull()
    expect(workerTracker.current!.posted).toEqual([
      { type: 'init', cacheDir: expect.stringContaining('ai-models') }
    ])
  })

  it('resolves once the worker reports ready', async () => {
    const promise = ensureModelReady()
    workerTracker.current!.emit('message', { type: 'ready' })

    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects (and allows retrying) on initError', async () => {
    const first = ensureModelReady()
    workerTracker.current!.emit('message', { type: 'initError', message: 'boom' })
    await expect(first).rejects.toThrow('boom')

    // A retry should send a fresh 'init', not reuse the failed promise.
    const secondWorker = workerTracker.current
    const second = ensureModelReady()
    expect(workerTracker.current!.posted).toEqual([
      { type: 'init', cacheDir: expect.stringContaining('ai-models') },
      { type: 'init', cacheDir: expect.stringContaining('ai-models') }
    ])
    expect(workerTracker.current).toBe(secondWorker)
    workerTracker.current!.emit('message', { type: 'ready' })
    await expect(second).resolves.toBeUndefined()
  })

  it('reports download progress via the onProgress callback', () => {
    const onProgress = vi.fn()
    // Never resolved in this test — see the identical note above.
    void ensureModelReady(onProgress).catch(() => undefined)
    workerTracker.current!.emit('message', { type: 'downloadProgress', progress: 42 })

    expect(onProgress).toHaveBeenCalledExactlyOnceWith(42)
  })

  it('suggestTags waits for the model, then classifies and resolves with the results', async () => {
    const promise = suggestTags('/thumb.jpg', ['a', 'b'])
    workerTracker.current!.emit('message', { type: 'ready' })
    await flush()

    const classifyMessage = workerTracker.current!.posted.find((m) => m.type === 'classify')
    expect(classifyMessage).toMatchObject({
      type: 'classify',
      imagePath: '/thumb.jpg',
      candidateLabels: ['a', 'b']
    })

    workerTracker.current!.emit('message', {
      type: 'result',
      requestId: classifyMessage!.requestId,
      results: [{ tag: 'a', score: 0.9 }]
    })

    await expect(promise).resolves.toEqual([{ tag: 'a', score: 0.9 }])
  })

  it('suggestTags rejects when the worker reports a classify error', async () => {
    const promise = suggestTags('/thumb.jpg', ['a'])
    workerTracker.current!.emit('message', { type: 'ready' })
    await flush()

    const classifyMessage = workerTracker.current!.posted.find((m) => m.type === 'classify')
    workerTracker.current!.emit('message', {
      type: 'classifyError',
      requestId: classifyMessage!.requestId,
      message: 'inference failed'
    })

    await expect(promise).rejects.toThrow('inference failed')
  })

  it('disposeTagSuggestionWorker rejects a caller still awaiting ensureModelReady', async () => {
    // Regression: disposing used to null out readyPromise without settling
    // it, leaving a caller mid-download (e.g. one Cancel needs to unblock)
    // hanging forever instead of seeing the model become unavailable.
    const promise = ensureModelReady()

    await disposeTagSuggestionWorker()

    await expect(promise).rejects.toThrow()
  })

  it('disposeTagSuggestionWorker terminates the worker and rejects pending requests', async () => {
    const promise = suggestTags('/thumb.jpg', ['a'])
    workerTracker.current!.emit('message', { type: 'ready' })
    await flush()
    const worker = workerTracker.current!

    await disposeTagSuggestionWorker()

    expect(worker.terminate).toHaveBeenCalledOnce()
    await expect(promise).rejects.toThrow()
  })

  it('embedImage waits for the model, then resolves with the embedding', async () => {
    const promise = embedImage('/thumb.jpg')
    workerTracker.current!.emit('message', { type: 'ready' })
    await flush()

    const embedMessage = workerTracker.current!.posted.find((m) => m.type === 'embed')
    expect(embedMessage).toMatchObject({ type: 'embed', imagePath: '/thumb.jpg' })

    workerTracker.current!.emit('message', {
      type: 'embedResult',
      requestId: embedMessage!.requestId,
      embedding: [0.1, 0.2, 0.3]
    })

    await expect(promise).resolves.toEqual([0.1, 0.2, 0.3])
  })

  it('embedImage rejects when the worker reports an embed error', async () => {
    const promise = embedImage('/thumb.jpg')
    workerTracker.current!.emit('message', { type: 'ready' })
    await flush()

    const embedMessage = workerTracker.current!.posted.find((m) => m.type === 'embed')
    workerTracker.current!.emit('message', {
      type: 'embedError',
      requestId: embedMessage!.requestId,
      message: 'embedding failed'
    })

    await expect(promise).rejects.toThrow('embedding failed')
  })

  it('classify and embed requests track independently by requestId', async () => {
    const classifyPromise = suggestTags('/thumb-a.jpg', ['a'])
    const embedPromise = embedImage('/thumb-b.jpg')
    workerTracker.current!.emit('message', { type: 'ready' })
    await flush()

    const classifyMessage = workerTracker.current!.posted.find((m) => m.type === 'classify')
    const embedMessage = workerTracker.current!.posted.find((m) => m.type === 'embed')
    expect(classifyMessage!.requestId).not.toBe(embedMessage!.requestId)

    // Resolving embed first shouldn't affect the still-pending classify call.
    workerTracker.current!.emit('message', {
      type: 'embedResult',
      requestId: embedMessage!.requestId,
      embedding: [1]
    })
    await expect(embedPromise).resolves.toEqual([1])

    workerTracker.current!.emit('message', {
      type: 'result',
      requestId: classifyMessage!.requestId,
      results: [{ tag: 'a', score: 0.5 }]
    })
    await expect(classifyPromise).resolves.toEqual([{ tag: 'a', score: 0.5 }])
  })
})
