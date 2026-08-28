import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SearchResult } from '@shared/types'

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

const searchPhotos = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  searchPhotos.mockReset()
  searchPhotos.mockResolvedValue(makeResult([]))
  // @ts-expect-error - partial window.api stub, only searchPhotos is exercised
  window.api = { searchPhotos }
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
})
