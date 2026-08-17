import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSetActiveTab = vi.fn()
let mockActiveTab = 'gallery'
let mockOpenTabs: string[] = []

vi.mock('@renderer/state/PhotoLibraryGalleryContext', () => ({
  useGalleryLibrary: () => ({
    state: { activeTab: mockActiveTab, openTabs: mockOpenTabs }
  })
}))
vi.mock('@renderer/state/PhotoLibraryActionsContext', () => ({
  useLibraryActions: () => ({ setActiveTab: mockSetActiveTab })
}))

import { useAppKeyboardShortcuts } from './useAppKeyboardShortcuts'

function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockActiveTab = 'gallery'
  mockOpenTabs = []
})

describe('useAppKeyboardShortcuts', () => {
  it('switches to the gallery tab on "g"', () => {
    renderHook(() => useAppKeyboardShortcuts())
    act(() => pressKey('g'))
    expect(mockSetActiveTab).toHaveBeenCalledWith('gallery')
  })

  it('switches to the dashboard tab on "d"', () => {
    renderHook(() => useAppKeyboardShortcuts())
    act(() => pressKey('d'))
    expect(mockSetActiveTab).toHaveBeenCalledWith('dashboard')
  })

  it('does not treat "g"/"d" as shortcuts while focus is in a text input', () => {
    renderHook(() => useAppKeyboardShortcuts())
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true })))

    expect(mockSetActiveTab).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('does not treat "g" as a shortcut when a modifier key is held', () => {
    renderHook(() => useAppKeyboardShortcuts())
    act(() => pressKey('g', { ctrlKey: true }))
    expect(mockSetActiveTab).not.toHaveBeenCalled()
  })

  it('cycles to the next tab with Alt+ArrowRight', () => {
    mockActiveTab = 'dashboard'
    renderHook(() => useAppKeyboardShortcuts())
    act(() => pressKey('ArrowRight', { altKey: true }))
    expect(mockSetActiveTab).toHaveBeenCalledWith('gallery')
  })

  it('cycles to the previous tab with Alt+ArrowLeft', () => {
    mockActiveTab = 'gallery'
    renderHook(() => useAppKeyboardShortcuts())
    act(() => pressKey('ArrowLeft', { altKey: true }))
    expect(mockSetActiveTab).toHaveBeenCalledWith('dashboard')
  })

  it('does not cycle past the last tab', () => {
    mockActiveTab = 'gallery'
    mockOpenTabs = []
    renderHook(() => useAppKeyboardShortcuts())
    act(() => pressKey('ArrowRight', { altKey: true }))
    expect(mockSetActiveTab).not.toHaveBeenCalled()
  })

  it('dispatches a synthetic Escape keydown on pointerdown, to dismiss floating Mantine elements', () => {
    renderHook(() => useAppKeyboardShortcuts())
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent')

    act(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))

    const escapeDispatch = dispatchSpy.mock.calls.find(
      ([event]) => event instanceof KeyboardEvent && event.key === 'Escape'
    )
    expect(escapeDispatch).toBeDefined()
    expect((escapeDispatch![0] as KeyboardEvent).isTrusted).toBe(false)
  })

  it('prevents Space from scrolling except on a native space-activatable element', () => {
    renderHook(() => useAppKeyboardShortcuts())
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    act(() => window.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
  })

  it('does not suppress Space when focus is on a button', () => {
    renderHook(() => useAppKeyboardShortcuts())
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    act(() => button.dispatchEvent(event))

    expect(event.defaultPrevented).toBe(false)
    document.body.removeChild(button)
  })
})
