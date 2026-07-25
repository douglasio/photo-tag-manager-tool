import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCtrlKeyHeld } from './useCtrlKeyHeld'

function dispatchKey(type: 'keydown' | 'keyup', key: string): void {
  window.dispatchEvent(new KeyboardEvent(type, { key }))
}

describe('useCtrlKeyHeld', () => {
  it('starts false', () => {
    const { result } = renderHook(() => useCtrlKeyHeld())
    expect(result.current).toBe(false)
  })

  it('becomes true on Control keydown and false again on keyup', () => {
    const { result } = renderHook(() => useCtrlKeyHeld())

    act(() => dispatchKey('keydown', 'Control'))
    expect(result.current).toBe(true)

    act(() => dispatchKey('keyup', 'Control'))
    expect(result.current).toBe(false)
  })

  it('ignores other keys', () => {
    const { result } = renderHook(() => useCtrlKeyHeld())
    act(() => dispatchKey('keydown', 'Shift'))
    expect(result.current).toBe(false)
  })

  it('resets to false on window blur, guarding against a stuck held state', () => {
    const { result } = renderHook(() => useCtrlKeyHeld())
    act(() => dispatchKey('keydown', 'Control'))
    expect(result.current).toBe(true)

    act(() => window.dispatchEvent(new Event('blur')))
    expect(result.current).toBe(false)
  })
})
