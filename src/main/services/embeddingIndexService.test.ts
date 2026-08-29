// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockFindReadyPhotosWithoutEmbeddings,
  mockGetAiTagSuggestionsEnabled,
  mockGetOrComputeEmbedding
} = vi.hoisted(() => ({
  mockFindReadyPhotosWithoutEmbeddings: vi.fn(),
  mockGetAiTagSuggestionsEnabled: vi.fn(),
  mockGetOrComputeEmbedding: vi.fn()
}))

vi.mock('@main/db/photoRepository', () => ({
  findReadyPhotosWithoutEmbeddings: mockFindReadyPhotosWithoutEmbeddings
}))
vi.mock('@main/db/settingsRepository', () => ({
  getAiTagSuggestionsEnabled: mockGetAiTagSuggestionsEnabled
}))
vi.mock('./photoEmbedding', () => ({ getOrComputeEmbedding: mockGetOrComputeEmbedding }))

// Exceeds the module's internal debounce window (3s) — tests only need
// "eventually, once idle" semantics, not the exact constant.
const PAST_DEBOUNCE_MS = 5000

function makePhotos(paths: string[]): { filePath: string; thumbnailKey: string }[] {
  return paths.map((filePath) => ({ filePath, thumbnailKey: `${filePath}-key` }))
}

describe('embeddingIndexService', () => {
  let mod: typeof import('./embeddingIndexService')
  let send: ReturnType<typeof vi.fn>

  // The module holds its running/suspended state at module scope (a real
  // singleton in production, one indexer for the whole app) — resetModules +
  // a fresh dynamic import gives each test a clean instance instead of
  // leaking suspended/running state from whatever the previous test left it in.
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    mockFindReadyPhotosWithoutEmbeddings.mockReset().mockReturnValue([])
    mockGetAiTagSuggestionsEnabled.mockReset().mockReturnValue(true)
    mockGetOrComputeEmbedding.mockReset().mockResolvedValue([1, 0])
    send = vi.fn()
    mod = await import('./embeddingIndexService')
    mod.setIndexTarget({ send, isDestroyed: () => false } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing until the debounce window elapses', async () => {
    mockFindReadyPhotosWithoutEmbeddings.mockReturnValue(makePhotos(['/a.jpg']))
    mod.kickIndexer()

    await vi.advanceTimersByTimeAsync(1000)
    expect(mockGetOrComputeEmbedding).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)
    expect(mockGetOrComputeEmbedding).toHaveBeenCalledWith('/a.jpg', '/a.jpg-key')
  })

  it('coalesces a burst of kicks into a single pass', async () => {
    mockFindReadyPhotosWithoutEmbeddings.mockReturnValue(makePhotos(['/a.jpg']))
    mod.kickIndexer()
    await vi.advanceTimersByTimeAsync(1000)
    mod.kickIndexer()
    await vi.advanceTimersByTimeAsync(1000)
    mod.kickIndexer()

    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)
    // Only one query for the work list, despite three kicks.
    expect(mockFindReadyPhotosWithoutEmbeddings).toHaveBeenCalledTimes(1)
  })

  it('does not start a pass while AI features are disabled', async () => {
    mockGetAiTagSuggestionsEnabled.mockReturnValue(false)
    mockFindReadyPhotosWithoutEmbeddings.mockReturnValue(makePhotos(['/a.jpg']))

    mod.kickIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    expect(mockGetOrComputeEmbedding).not.toHaveBeenCalled()
  })

  it('broadcasts progress and clears it (with a null send) once the pass finishes', async () => {
    mockFindReadyPhotosWithoutEmbeddings.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg']))
    mod.kickIndexer()

    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    const payloads = send.mock.calls.filter(([channel]) => channel === 'ai:indexProgress')
    expect(payloads.at(-2)?.[1]).toEqual({ done: 2, total: 2 })
    expect(payloads.at(-1)?.[1]).toBeNull()
    expect(mod.getIndexStatus()).toBeNull()
  })

  it('skips a photo that fails to embed instead of aborting the pass', async () => {
    mockFindReadyPhotosWithoutEmbeddings.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg', '/c.jpg']))
    mockGetOrComputeEmbedding.mockImplementation((filePath: string) =>
      filePath === '/b.jpg' ? Promise.reject(new Error('corrupt')) : Promise.resolve([1, 0])
    )

    mod.kickIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    expect(mockGetOrComputeEmbedding).toHaveBeenCalledTimes(3)
    expect(mod.getIndexStatus()).toBeNull()
  })

  it('a kick during a running pass re-queries once, rather than being dropped', async () => {
    mockFindReadyPhotosWithoutEmbeddings.mockReturnValueOnce(makePhotos(['/a.jpg']))
    let resolveA: (value: number[]) => void = () => {}
    mockGetOrComputeEmbedding.mockImplementationOnce(
      () =>
        new Promise<number[]>((resolve) => {
          resolveA = resolve
        })
    )

    mod.kickIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)
    // The pass is now awaiting /a.jpg's embedding — this kick lands mid-pass.
    mockFindReadyPhotosWithoutEmbeddings.mockReturnValueOnce(makePhotos(['/b.jpg']))
    mockGetOrComputeEmbedding.mockResolvedValue([1, 0])
    mod.kickIndexer()

    resolveA([1, 0])
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()

    // Re-queried and picked up /b.jpg without waiting for another debounce window.
    expect(mockGetOrComputeEmbedding).toHaveBeenCalledWith('/b.jpg', '/b.jpg-key')
    expect(mockFindReadyPhotosWithoutEmbeddings).toHaveBeenCalledTimes(2)
  })

  it('stopIndexer halts before the next photo, and resumeIndexer picks back up', async () => {
    mockFindReadyPhotosWithoutEmbeddings.mockReturnValueOnce(makePhotos(['/a.jpg', '/b.jpg']))
    let resolveA: (value: number[]) => void = () => {}
    mockGetOrComputeEmbedding.mockImplementationOnce(
      () =>
        new Promise<number[]>((resolve) => {
          resolveA = resolve
        })
    )

    mod.kickIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    const stopped = mod.stopIndexer()
    resolveA([1, 0])
    await stopped

    // /a.jpg's already-in-flight call completed, but /b.jpg was never started.
    expect(mockGetOrComputeEmbedding).toHaveBeenCalledTimes(1)
    expect(mod.getIndexStatus()).toBeNull()

    mockFindReadyPhotosWithoutEmbeddings.mockReturnValueOnce(makePhotos(['/b.jpg']))
    mockGetOrComputeEmbedding.mockResolvedValue([1, 0])
    mod.resumeIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    expect(mockGetOrComputeEmbedding).toHaveBeenCalledWith('/b.jpg', '/b.jpg-key')
  })

  it('kickIndexer no-ops while suspended', async () => {
    await mod.stopIndexer()
    mockFindReadyPhotosWithoutEmbeddings.mockReturnValue(makePhotos(['/a.jpg']))

    mod.kickIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    expect(mockGetOrComputeEmbedding).not.toHaveBeenCalled()
  })
})
