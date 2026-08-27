import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockAllTags: string[]
const mockSuggestTags = vi.fn()

vi.mock('@state', () => ({
  usePreviewTriggerHeld: () => false,
  usePhotoLibrary: () => ({
    allTags: mockAllTags,
    suggestTags: mockSuggestTags
  })
}))

import { useTagSuggestions } from './useTagSuggestions'

describe('useTagSuggestions', () => {
  beforeEach(() => {
    mockSuggestTags.mockReset().mockResolvedValue([])
    mockAllTags = ['vacation', 'family']
  })

  it('does not fetch when inactive', () => {
    renderHook(() => useTagSuggestions('/a.jpg', [], false))

    expect(mockSuggestTags).not.toHaveBeenCalled()
  })

  it('does not fetch when there are no known tags to suggest from', () => {
    mockAllTags = []
    renderHook(() => useTagSuggestions('/a.jpg', [], true))

    expect(mockSuggestTags).not.toHaveBeenCalled()
  })

  it('fetches suggestions for the given photo when active', () => {
    renderHook(() => useTagSuggestions('/a.jpg', [], true))

    expect(mockSuggestTags).toHaveBeenCalledExactlyOnceWith('/a.jpg', ['vacation', 'family'])
  })

  it('is loading synchronously, then resolves with the results', async () => {
    mockSuggestTags.mockResolvedValue([{ tag: 'vacation', score: 0.9 }])
    const { result } = renderHook(() => useTagSuggestions('/a.jpg', [], true))

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.suggestions).toEqual([{ tag: 'vacation', score: 0.9 }])
  })

  it('excludes tags already applied to the photo', async () => {
    mockSuggestTags.mockResolvedValue([
      { tag: 'vacation', score: 0.9 },
      { tag: 'family', score: 0.4 }
    ])
    const { result } = renderHook(() => useTagSuggestions('/a.jpg', ['vacation'], true))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.suggestions).toEqual([{ tag: 'family', score: 0.4 }])
  })

  it('refetches when the photo changes', async () => {
    const { result, rerender } = renderHook(
      ({ filePath }) => useTagSuggestions(filePath, [], true),
      { initialProps: { filePath: '/a.jpg' } }
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender({ filePath: '/b.jpg' })

    expect(mockSuggestTags).toHaveBeenNthCalledWith(2, '/b.jpg', ['vacation', 'family'])
  })
})
