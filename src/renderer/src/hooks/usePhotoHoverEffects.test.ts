import { act, renderHook } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { describe, expect, it } from 'vitest'

import { usePhotoHoverEffects } from './usePhotoHoverEffects'

function fakeMouseEvent(x: number, y: number): ReactMouseEvent<HTMLElement> {
  return {
    clientX: x,
    clientY: y,
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
    }
  } as unknown as ReactMouseEvent<HTMLElement>
}

describe('usePhotoHoverEffects', () => {
  it('returns a stable shape with handlers and style objects', () => {
    const { result } = renderHook(() => usePhotoHoverEffects(true))
    expect(result.current.saturationAmount).toBeGreaterThan(1)
    expect(typeof result.current.containerHandlers.onMouseMove).toBe('function')
    expect(typeof result.current.containerHandlers.onMouseEnter).toBe('function')
    expect(typeof result.current.containerHandlers.onMouseLeave).toBe('function')
    expect(result.current.zoomStyle.transformOrigin).toBe('center center')
    expect(result.current.saturationOverlayStyle.maskImage).toBeDefined()
  })

  it('does not throw when disabled and handlers are invoked', () => {
    const { result } = renderHook(() => usePhotoHoverEffects(false))
    expect(() => {
      act(() => {
        result.current.containerHandlers.onMouseEnter()
        result.current.containerHandlers.onMouseMove(fakeMouseEvent(50, 50))
        result.current.containerHandlers.onMouseLeave()
      })
    }).not.toThrow()
  })

  it('updates the zoom transform-origin as the cursor moves while enabled', () => {
    const { result } = renderHook(() => usePhotoHoverEffects(true))
    act(() => {
      result.current.containerHandlers.onMouseEnter()
      result.current.containerHandlers.onMouseMove(fakeMouseEvent(25, 75))
    })
    expect(result.current.zoomStyle.transformOrigin).toBe('25% 75%')
  })

  it('mouse leave resets without throwing, including after trigger-zoom was active', () => {
    const { result } = renderHook(() => usePhotoHoverEffects(true))
    act(() => {
      result.current.containerHandlers.onMouseEnter()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      result.current.containerHandlers.onMouseMove(fakeMouseEvent(10, 10))
    })
    expect(() => {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))
        result.current.containerHandlers.onMouseLeave()
      })
    }).not.toThrow()
  })
})
