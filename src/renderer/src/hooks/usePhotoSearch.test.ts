import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SearchResult, SemanticSearchResult } from '@shared/types'

import { usePhotoSearch } from './usePhotoSearch'

// Advances past the debounce and drains the promise chain. Testing Library's
// waitFor polls on real timers, so it deadlocks under fake ones.
async function flushSearch(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(200)
    await Promise.resolve()
    await Promise.resolve()
  })
}

function makeResult(paths: string[]): SearchResult {
  return {
    hits: paths.map((filePath) => ({
      filePath,
      fileName: filePath.split('/').pop() ?? filePath,
      score: 1,
      thumbnailKey: null
    })),
    total: paths.length,
    paths
  }
}

function makeSemanticResult(paths: string[]): SemanticSearchResult {
  return {
    hits: paths.map((filePath) => ({
      filePath,
      fileName: filePath.split('/').pop() ?? filePath,
      score: 0.3,
      thumbnailKey: null
    })),
    indexedCount: paths.length,
    totalReadyCount: paths.length
  }
}

const EMPTY_SEMANTIC = makeSemanticResult([])

const searchPhotos = vi.fn()
const semanticSearchPhotos = vi.fn()

// Captures the hook's subscription callback so tests can simulate a push
// event from the main process, the same way window.api's real subscribe
// helper delivers ai:indexProgress-style events.
let progressCallback: ((progress: number) => void) | null = null
const onSemanticModelProgress = vi.fn((callback: (progress: number) => void) => {
  progressCallback = callback
  return () => {
    if (progressCallback === callback) progressCallback = null
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  searchPhotos.mockReset()
  searchPhotos.mockResolvedValue(makeResult([]))
  semanticSearchPhotos.mockReset()
  semanticSearchPhotos.mockResolvedValue(EMPTY_SEMANTIC)
  onSemanticModelProgress.mockClear()
  progressCallback = null
  // @ts-expect-error - partial window.api stub, only these three are exercised
  window.api = { searchPhotos, semanticSearchPhotos, onSemanticModelProgress }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePhotoSearch', () => {
  it('does not query the main process until the debounce elapses', async () => {
    const { result } = renderHook(() => usePhotoSearch())

    act(() => result.current.setText('beach'))
    expect(searchPhotos).not.toHaveBeenCalled()

    await flushSearch()
    expect(searchPhotos).toHaveBeenCalledTimes(1)
  })

  it('collapses a burst of keystrokes into one query', async () => {
    const { result } = renderHook(() => usePhotoSearch())

    act(() => result.current.setText('b'))
    act(() => result.current.setText('be'))
    act(() => result.current.setText('bea'))
    act(() => result.current.setText('beach'))

    await flushSearch()

    expect(searchPhotos).toHaveBeenCalledTimes(1)
    expect(searchPhotos.mock.calls[0][0].predicates[0]).toMatchObject({ value: 'beach' })
  })

  it('never queries for an empty query, and clears any previous result', async () => {
    const { result } = renderHook(() => usePhotoSearch())
    searchPhotos.mockResolvedValue(makeResult(['/a.jpg']))

    act(() => result.current.setText('beach'))
    await flushSearch()
    expect(result.current.result.total).toBe(1)

    act(() => result.current.setText('   '))
    await flushSearch()

    expect(result.current.result.total).toBe(0)
    expect(searchPhotos).toHaveBeenCalledTimes(1)
  })

  // The race the plan called out: a slow early query must not overwrite the
  // result of a newer one that already resolved.
  it('drops an out-of-order response from a superseded query', async () => {
    let resolveSlow: ((value: SearchResult) => void) | undefined
    searchPhotos.mockImplementationOnce(
      () =>
        new Promise<SearchResult>((resolve) => {
          resolveSlow = resolve
        })
    )
    searchPhotos.mockResolvedValueOnce(makeResult(['/fast.jpg']))

    const { result } = renderHook(() => usePhotoSearch())

    act(() => result.current.setText('slow'))
    await flushSearch()

    act(() => result.current.setText('fast'))
    await flushSearch()
    expect(result.current.result.paths).toEqual(['/fast.jpg'])

    // The stale query finally answers — it must be ignored.
    await act(async () => {
      resolveSlow?.(makeResult(['/slow.jpg']))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.result.paths).toEqual(['/fast.jpg'])
  })

  it('re-queries when the excluded-folders toggle flips, same text', async () => {
    const { result } = renderHook(() => usePhotoSearch())

    act(() => result.current.setText('beach'))
    await flushSearch()
    expect(searchPhotos.mock.calls[0][0].includeExcluded).toBe(false)

    act(() => result.current.setIncludeExcluded(true))
    await flushSearch()

    expect(searchPhotos).toHaveBeenCalledTimes(2)
    expect(searchPhotos.mock.calls[1][0].includeExcluded).toBe(true)
  })

  it('recovers from a failed query instead of hanging in a loading state', async () => {
    searchPhotos.mockRejectedValue(new Error('boom'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => usePhotoSearch())

    act(() => result.current.setText('beach'))
    await flushSearch()

    expect(result.current.loading).toBe(false)
    expect(result.current.result.total).toBe(0)
    consoleError.mockRestore()
  })

  describe('semantic search', () => {
    it('fires alongside the facet query for free-text terms', async () => {
      semanticSearchPhotos.mockResolvedValue(makeSemanticResult(['/beach.jpg']))
      const { result } = renderHook(() => usePhotoSearch())

      act(() => result.current.setText('beach'))
      await flushSearch()

      expect(semanticSearchPhotos).toHaveBeenCalledTimes(1)
      expect(result.current.semanticResult.hits[0].filePath).toBe('/beach.jpg')
    })

    it('skips the round trip for flags-only queries with no free text', async () => {
      const { result } = renderHook(() => usePhotoSearch())

      act(() => result.current.setText('tag:beach person:joe'))
      await flushSearch()

      expect(searchPhotos).toHaveBeenCalledTimes(1)
      expect(semanticSearchPhotos).not.toHaveBeenCalled()
    })

    it('does not block facet results on a slow semantic response', async () => {
      searchPhotos.mockResolvedValue(makeResult(['/exact.jpg']))
      semanticSearchPhotos.mockImplementation(() => new Promise(() => undefined))
      const { result } = renderHook(() => usePhotoSearch())

      act(() => result.current.setText('beach'))
      await flushSearch()

      expect(result.current.result.paths).toEqual(['/exact.jpg'])
      expect(result.current.loading).toBe(false)
      expect(result.current.semanticLoading).toBe(true)
    })

    it('drops a stale semantic response the same way the facet query does', async () => {
      let resolveSlow: ((value: SemanticSearchResult) => void) | undefined
      semanticSearchPhotos.mockImplementationOnce(
        () =>
          new Promise<SemanticSearchResult>((resolve) => {
            resolveSlow = resolve
          })
      )
      semanticSearchPhotos.mockResolvedValueOnce(makeSemanticResult(['/fast.jpg']))

      const { result } = renderHook(() => usePhotoSearch())

      act(() => result.current.setText('slow'))
      await flushSearch()

      act(() => result.current.setText('fast'))
      await flushSearch()
      expect(result.current.semanticResult.hits.map((hit) => hit.filePath)).toEqual(['/fast.jpg'])

      await act(async () => {
        resolveSlow?.(makeSemanticResult(['/slow.jpg']))
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.semanticResult.hits.map((hit) => hit.filePath)).toEqual(['/fast.jpg'])
    })

    it('recovers from a failed semantic query instead of hanging in a loading state', async () => {
      semanticSearchPhotos.mockRejectedValue(new Error('boom'))
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = renderHook(() => usePhotoSearch())

      act(() => result.current.setText('beach'))
      await flushSearch()

      expect(result.current.semanticLoading).toBe(false)
      expect(result.current.semanticResult.hits).toEqual([])
      consoleError.mockRestore()
    })
  })

  describe('model download progress', () => {
    it('subscribes once on mount and surfaces a pushed progress value', () => {
      const { result } = renderHook(() => usePhotoSearch())

      expect(onSemanticModelProgress).toHaveBeenCalledTimes(1)
      expect(result.current.modelDownloadProgress).toBeNull()

      act(() => progressCallback?.(42))

      expect(result.current.modelDownloadProgress).toBe(42)
    })

    it('clears the progress once the semantic query it belongs to settles', async () => {
      let resolveSemantic: ((value: SemanticSearchResult) => void) | undefined
      semanticSearchPhotos.mockImplementation(
        () =>
          new Promise<SemanticSearchResult>((resolve) => {
            resolveSemantic = resolve
          })
      )
      const { result } = renderHook(() => usePhotoSearch())

      act(() => result.current.setText('beach'))
      await flushSearch()
      act(() => progressCallback?.(75))
      expect(result.current.modelDownloadProgress).toBe(75)

      await act(async () => {
        resolveSemantic?.(EMPTY_SEMANTIC)
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.modelDownloadProgress).toBeNull()
    })

    it('resets stale progress from an abandoned query when a new one starts', async () => {
      semanticSearchPhotos.mockImplementation(() => new Promise(() => undefined))
      const { result } = renderHook(() => usePhotoSearch())

      act(() => result.current.setText('slow'))
      await flushSearch()
      act(() => progressCallback?.(30))
      expect(result.current.modelDownloadProgress).toBe(30)

      act(() => result.current.setText('fast'))
      await flushSearch()

      expect(result.current.modelDownloadProgress).toBeNull()
    })
  })
})
