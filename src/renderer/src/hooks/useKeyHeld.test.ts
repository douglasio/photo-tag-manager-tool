import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useKeyHeld } from './useKeyHeld'

function dispatchKey(type: 'keydown' | 'keyup', key: string): void {
  window.dispatchEvent(new KeyboardEvent(type, { key }))
}

describe('useKeyHeld', () => {
  it('starts false', () => {
    const { result } = renderHook(() => useKeyHeld('Control'))
    expect(result.current).toBe(false)
  })

  it('becomes true on matching keydown and false again on keyup', () => {
    const { result } = renderHook(() => useKeyHeld('Control'))

    act(() => dispatchKey('keydown', 'Control'))
    expect(result.current).toBe(true)

    act(() => dispatchKey('keyup', 'Control'))
    expect(result.current).toBe(false)
  })

  it('ignores other keys', () => {
    const { result } = renderHook(() => useKeyHeld('Control'))
    act(() => dispatchKey('keydown', 'Shift'))
    expect(result.current).toBe(false)
  })

  it('resets to false on window blur, guarding against a stuck held state', () => {
    const { result } = renderHook(() => useKeyHeld('Control'))
    act(() => dispatchKey('keydown', 'Control'))
    expect(result.current).toBe(true)

    act(() => window.dispatchEvent(new Event('blur')))
    expect(result.current).toBe(false)
  })

  it('tracks whichever key it was given, e.g. Space', () => {
    const { result } = renderHook(() => useKeyHeld(' '))
    act(() => dispatchKey('keydown', ' '))
    expect(result.current).toBe(true)
  })
})
