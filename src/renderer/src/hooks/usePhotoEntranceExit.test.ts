import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePhotoEntranceExit } from './usePhotoEntranceExit'

describe('usePhotoEntranceExit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders straight at the resting state when motion is disabled', () => {
    const { result } = renderHook(() =>
      usePhotoEntranceExit({ motionEnabled: false, enterDirection: null })
    )
    expect(result.current.initial).toBe(false)
    expect(result.current.animate).toEqual({ scale: 1, x: 0, filter: 'blur(0px)', opacity: 1 })
  })

  it('holds at the initial (blurred/scaled) target until ready', () => {
    const { result } = renderHook(() =>
      usePhotoEntranceExit({ motionEnabled: true, enterDirection: null })
    )
    expect(result.current.initial).not.toBe(false)
    expect(result.current.animate).toEqual(result.current.initial)
  })

  it('applies a positive x offset for entering from the right, negative for the left', () => {
    const right = renderHook(() =>
      usePhotoEntranceExit({ motionEnabled: true, enterDirection: 'right' })
    )
    expect((right.result.current.initial as { x: number }).x).toBeGreaterThan(0)

    const left = renderHook(() =>
      usePhotoEntranceExit({ motionEnabled: true, enterDirection: 'left' })
    )
    expect((left.result.current.initial as { x: number }).x).toBeLessThan(0)
  })

  it('settles to the resting state once the image loads and layout settles', () => {
    const { result } = renderHook(() =>
      usePhotoEntranceExit({ motionEnabled: true, enterDirection: null })
    )

    act(() => result.current.handleImageLoad())
    // Still waiting on the layout-settle timer.
    expect(result.current.animate).toEqual(result.current.initial)

    act(() => vi.runAllTimers())
    expect(result.current.animate).toEqual({ scale: 1, x: 0, filter: 'blur(0px)', opacity: 1 })
  })

  it('triggerExit switches to the exit target and fires onDone after the exit duration', () => {
    const { result } = renderHook(() =>
      usePhotoEntranceExit({ motionEnabled: true, enterDirection: null })
    )
    const onDone = vi.fn()

    let started = false
    act(() => {
      started = result.current.triggerExit('right', onDone)
    })
    expect(started).toBe(true)
    expect(result.current.exitDirection).toBe('right')
    expect(result.current.animate.opacity).toBe(0)
    expect(onDone).not.toHaveBeenCalled()

    act(() => vi.runAllTimers())
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('ignores a second triggerExit while one is already in progress', () => {
    const { result } = renderHook(() =>
      usePhotoEntranceExit({ motionEnabled: true, enterDirection: null })
    )
    const first = vi.fn()
    const second = vi.fn()

    act(() => {
      result.current.triggerExit('right', first)
    })
    let startedAgain = true
    act(() => {
      startedAgain = result.current.triggerExit('left', second)
    })
    expect(startedAgain).toBe(false)

    act(() => vi.runAllTimers())
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it('rejects a second exit from a stale closure, e.g. OS key-repeat outrunning a re-render', () => {
    // Captures triggerExit once and calls it twice without re-reading
    // result.current in between — this is what a keydown listener sees if
    // two keydown events fire before React re-renders and resubscribes it.
    // The guard must hold even though both calls read the same (pre-update)
    // exitDirection from this one closure.
    const { result } = renderHook(() =>
      usePhotoEntranceExit({ motionEnabled: true, enterDirection: null })
    )
    const staleTriggerExit = result.current.triggerExit
    const first = vi.fn()
    const second = vi.fn()

    let firstStarted = false
    let secondStarted = true
    act(() => {
      firstStarted = staleTriggerExit('right', first)
      secondStarted = staleTriggerExit('left', second)
    })

    expect(firstStarted).toBe(true)
    expect(secondStarted).toBe(false)

    act(() => vi.runAllTimers())
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })
})
