import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useHoverPreview } from './useHoverPreview'

function fakeMouseEvent(x: number, y: number): { clientX: number; clientY: number } {
  return { clientX: x, clientY: y }
}

describe('useHoverPreview', () => {
  it('starts with no position', () => {
    const { result } = renderHook(() => useHoverPreview(true))
    expect(result.current.position).toBeNull()
  })

  it('updates position on mouse move while enabled', () => {
    const { result } = renderHook(() => useHoverPreview(true))
    act(() => result.current.onMouseMove(fakeMouseEvent(10, 20)))
    expect(result.current.position).toEqual({ x: 10, y: 20 })
  })

  it('does not surface a position while disabled', () => {
    const { result } = renderHook(() => useHoverPreview(false))
    act(() => result.current.onMouseMove(fakeMouseEvent(10, 20)))
    expect(result.current.position).toBeNull()
  })

  it('seeds the position immediately once enabled, from moves made while disabled', () => {
    const { result, rerender } = renderHook(({ enabled }) => useHoverPreview(enabled), {
      initialProps: { enabled: false }
    })
    act(() => result.current.onMouseMove(fakeMouseEvent(30, 40)))
    expect(result.current.position).toBeNull()

    rerender({ enabled: true })
    expect(result.current.position).toEqual({ x: 30, y: 40 })
  })

  it('clears the position on mouse leave', () => {
    const { result } = renderHook(() => useHoverPreview(true))
    act(() => result.current.onMouseMove(fakeMouseEvent(10, 20)))
    act(() => result.current.onMouseLeave())
    expect(result.current.position).toBeNull()
  })

  it('does not resurrect a stale position after leaving once re-enabled', () => {
    const { result, rerender } = renderHook(({ enabled }) => useHoverPreview(enabled), {
      initialProps: { enabled: true }
    })
    act(() => result.current.onMouseMove(fakeMouseEvent(10, 20)))
    act(() => result.current.onMouseLeave())

    rerender({ enabled: false })
    rerender({ enabled: true })
    expect(result.current.position).toBeNull()
  })
})
