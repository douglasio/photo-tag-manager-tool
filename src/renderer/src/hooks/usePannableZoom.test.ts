import { act, renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent, SyntheticEvent } from 'react'
import { describe, expect, it } from 'vitest'

import type { PhotoRecord } from '@shared/types'

import { usePannableZoom } from './usePannableZoom'

function makePhoto(filePath: string): PhotoRecord {
  return {
    id: filePath,
    filePath,
    fileName: filePath.split('/').pop() ?? filePath,
    tags: [],
    metadata: {
      dateTaken: null,
      cameraMake: null,
      cameraModel: null,
      widthPx: null,
      heightPx: null,
      fileSizeBytes: 0,
      format: 'JPEG',
      comment: null
    },
    thumbnailStatus: 'pending',
    thumbnailKey: null,
    scanError: null,
    fromCache: false,
    viewCount: 0
  }
}

function fakeContainer(width: number, height: number): HTMLDivElement {
  return {
    clientWidth: width,
    clientHeight: height,
    addEventListener: () => {},
    removeEventListener: () => {}
  } as unknown as HTMLDivElement
}

function fakePointerEvent(x: number, y: number): ReactPointerEvent<HTMLDivElement> {
  return {
    pointerId: 1,
    clientX: x,
    clientY: y,
    currentTarget: { setPointerCapture: () => {} }
  } as unknown as ReactPointerEvent<HTMLDivElement>
}

function fakeImageLoadEvent(width: number, height: number): SyntheticEvent<HTMLImageElement> {
  return {
    currentTarget: { naturalWidth: width, naturalHeight: height }
  } as unknown as SyntheticEvent<HTMLImageElement>
}

describe('usePannableZoom', () => {
  it('starts at scale 1, centered, with no base size until an image loads', () => {
    const { result } = renderHook(() => usePannableZoom(makePhoto('/a.jpg')))
    expect(result.current.scale).toBe(1)
    expect(result.current.pan).toEqual({ x: 0, y: 0 })
    expect(result.current.isDragging).toBe(false)
    expect(result.current.baseSize).toBeNull()
    expect(result.current.anchor).toBeNull()
    expect(result.current.min).toBe(0.5)
    expect(result.current.max).toBe(5)
  })

  it('handleImageLoad ignores a missing container ref', () => {
    const { result } = renderHook(() => usePannableZoom(makePhoto('/a.jpg')))
    act(() => result.current.handleImageLoad(fakeImageLoadEvent(800, 600)))
    expect(result.current.baseSize).toBeNull()
  })

  it('cover fit (default) pre-zooms past scale 1 to fill a mismatched frame', () => {
    const { result } = renderHook(() => usePannableZoom(makePhoto('/a.jpg')))
    act(() => {
      result.current.containerRef.current = fakeContainer(200, 200)
    })
    act(() => result.current.handleImageLoad(fakeImageLoadEvent(800, 400)))
    expect(result.current.baseSize).toEqual({ width: 200, height: 100 })
    expect(result.current.anchor).toEqual({ x: 100, y: 100 })
    expect(result.current.scale).toBeGreaterThan(1)
  })

  it('contain fit stays at scale 1 so the whole frame is visible', () => {
    const { result } = renderHook(() =>
      usePannableZoom(makePhoto('/a.jpg'), { defaultFit: 'contain' })
    )
    act(() => {
      result.current.containerRef.current = fakeContainer(200, 200)
    })
    act(() => result.current.handleImageLoad(fakeImageLoadEvent(800, 400)))
    expect(result.current.scale).toBe(1)
  })

  it('drags pan while pointer is down, and ignores moves once released', () => {
    const { result } = renderHook(() => usePannableZoom(makePhoto('/a.jpg')))
    act(() => result.current.handlePointerDown(fakePointerEvent(10, 10)))
    expect(result.current.isDragging).toBe(true)
    act(() => result.current.handlePointerMove(fakePointerEvent(30, 25)))
    expect(result.current.pan).toEqual({ x: 20, y: 15 })

    act(() => result.current.stopDragging())
    expect(result.current.isDragging).toBe(false)
    act(() => result.current.handlePointerMove(fakePointerEvent(100, 100)))
    // Move after release is ignored — pan unchanged.
    expect(result.current.pan).toEqual({ x: 20, y: 15 })
  })

  it('zoomToFit resets both scale and pan', () => {
    const { result } = renderHook(() => usePannableZoom(makePhoto('/a.jpg')))
    act(() => result.current.handlePointerDown(fakePointerEvent(0, 0)))
    act(() => result.current.handlePointerMove(fakePointerEvent(50, 50)))
    act(() => result.current.setScale(3))
    act(() => result.current.zoomToFit())
    expect(result.current.scale).toBe(1)
    expect(result.current.pan).toEqual({ x: 0, y: 0 })
  })

  it('zoomToNativeSize is a no-op before an image has loaded', () => {
    const { result } = renderHook(() => usePannableZoom(makePhoto('/a.jpg')))
    act(() => result.current.zoomToNativeSize())
    expect(result.current.scale).toBe(1)
  })

  it('zoomToNativeSize computes the ratio back to true pixel size', () => {
    const { result } = renderHook(() => usePannableZoom(makePhoto('/a.jpg')))
    act(() => {
      result.current.containerRef.current = fakeContainer(200, 200)
    })
    act(() => result.current.handleImageLoad(fakeImageLoadEvent(800, 400)))
    act(() => result.current.zoomToNativeSize())
    // baseSize.width is 200 (contain-fit), natural is 800 — ratio 4, clamped to max 5.
    expect(result.current.scale).toBe(4)
  })

  it('zoomIn/zoomOut step and clamp at the min/max bounds', () => {
    const { result } = renderHook(() => usePannableZoom(makePhoto('/a.jpg')))
    act(() => result.current.setScale(0.5))
    act(() => result.current.zoomOut())
    expect(result.current.scale).toBe(0.5)

    act(() => result.current.setScale(5))
    act(() => result.current.zoomIn())
    expect(result.current.scale).toBe(5)
  })

  it('setScale clamps out-of-range values', () => {
    const { result } = renderHook(() => usePannableZoom(makePhoto('/a.jpg')))
    act(() => result.current.setScale(100))
    expect(result.current.scale).toBe(5)
    act(() => result.current.setScale(-10))
    expect(result.current.scale).toBe(0.5)
  })

  it('returns a referentially stable object across a re-render where nothing changed', () => {
    const { result, rerender } = renderHook(({ photo }) => usePannableZoom(photo), {
      initialProps: { photo: makePhoto('/a.jpg') }
    })
    const first = result.current
    // A new photo object with the same filePath doesn't trip resetKey — a
    // caller reporting this object up to a parent (e.g. PhotoView) relies on
    // this identity staying stable to avoid looping.
    rerender({ photo: makePhoto('/a.jpg') })
    expect(result.current).toBe(first)
  })

  it('resets scale/pan/baseSize/anchor when the photo prop changes', () => {
    const { result, rerender } = renderHook(({ photo }) => usePannableZoom(photo), {
      initialProps: { photo: makePhoto('/a.jpg') }
    })
    act(() => {
      result.current.containerRef.current = fakeContainer(200, 200)
    })
    act(() => result.current.handleImageLoad(fakeImageLoadEvent(800, 400)))
    act(() => result.current.setScale(3))
    expect(result.current.baseSize).not.toBeNull()

    rerender({ photo: makePhoto('/b.jpg') })

    expect(result.current.scale).toBe(1)
    expect(result.current.pan).toEqual({ x: 0, y: 0 })
    expect(result.current.baseSize).toBeNull()
    expect(result.current.anchor).toBeNull()
  })
})
