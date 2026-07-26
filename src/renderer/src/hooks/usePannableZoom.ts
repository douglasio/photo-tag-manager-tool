import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SyntheticEvent
} from 'react'
import type { PhotoRecord } from '../../../shared/types'

const MIN_SCALE = 0.5
const MAX_SCALE = 5
const SCALE_STEP = 0.25
const WHEEL_ZOOM_SENSITIVITY = 0.0025

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

interface Size {
  width: number
  height: number
}

export interface UsePannableZoomResult {
  containerRef: RefObject<HTMLDivElement | null>
  scale: number
  setScale: (value: number) => void
  pan: { x: number; y: number }
  isDragging: boolean
  baseSize: Size | null
  handlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  stopDragging: () => void
  handleImageLoad: (event: SyntheticEvent<HTMLImageElement>) => void
  zoomToFit: () => void
  zoomToNativeSize: () => void
  zoomOut: () => void
  zoomIn: () => void
  min: number
  max: number
}

interface UsePannableZoomOptions {
  // 'cover' (default) starts zoomed in to fill the frame with no
  // letterboxing, like the compare view wants. 'contain' starts at the
  // frame-fit size so the whole image is visible, like the magazine view
  // wants (its frame is already cropped to a fixed aspect ratio).
  defaultFit?: 'cover' | 'contain'
}

// Drag-to-pan + wheel-to-zoom state for a single image, shared by
// PannableZoomableImage's own inline toolbar (compare view) and callers that
// render the zoom controls elsewhere themselves (PhotoView's magazine mode,
// so they land in its single footer bar instead of a separate floating one).
export function usePannableZoom(
  photo: PhotoRecord,
  options: UsePannableZoomOptions = {}
): UsePannableZoomResult {
  const { defaultFit = 'cover' } = options
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragOrigin = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 })

  // The image renders at this fixed pixel size (adjusted only by `scale`)
  // rather than a percentage-based maw/mah + object-fit, which would
  // otherwise recompute — and visibly resize the image — every time its
  // container resizes (e.g. a Splitter handle moving). Computed once from
  // the container's size at load time, like object-fit: contain would, but
  // then held fixed. naturalSize is kept alongside it so "Original size" can
  // invert exactly the same fit ratio.
  const [baseSize, setBaseSize] = useState<Size | null>(null)
  const [naturalSize, setNaturalSize] = useState<Size | null>(null)

  // Reset pan/zoom/base-size whenever the photo changes, adjusted during
  // render per this codebase's convention for resetting state on prop change.
  const [resetKey, setResetKey] = useState(photo.filePath)
  if (resetKey !== photo.filePath) {
    setResetKey(photo.filePath)
    setScale(1)
    setPan({ x: 0, y: 0 })
    setBaseSize(null)
    setNaturalSize(null)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Native listener (not React's passive synthetic onWheel) so
    // preventDefault actually stops page/gallery scroll underneath.
    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault()
      setScale((prev) => clampScale(prev - event.deltaY * WHEEL_ZOOM_SENSITIVITY))
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOrigin.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y
    }
    setIsDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!isDragging) return
    const { startX, startY, originX, originY } = dragOrigin.current
    setPan({ x: originX + (event.clientX - startX), y: originY + (event.clientY - startY) })
  }

  const stopDragging = (): void => setIsDragging(false)

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>): void => {
    const { naturalWidth, naturalHeight } = event.currentTarget as HTMLImageElement
    const container = containerRef.current
    if (!container || !naturalWidth || !naturalHeight) return
    setNaturalSize({ width: naturalWidth, height: naturalHeight })
    const containScale = Math.min(
      1,
      container.clientWidth / naturalWidth,
      container.clientHeight / naturalHeight
    )
    setBaseSize({ width: naturalWidth * containScale, height: naturalHeight * containScale })
    if (defaultFit === 'contain') {
      // baseSize is already the contain-fit size, so no pre-zoom needed —
      // the whole frame is visible at scale 1.
      setScale(1)
      return
    }
    // Default to filling the frame (like object-fit: cover) rather than
    // letterboxing, by pre-zooming up from the contain baseline.
    const coverScale = Math.max(
      container.clientWidth / naturalWidth,
      container.clientHeight / naturalHeight
    )
    setScale(clampScale(coverScale / containScale))
  }

  const zoomToFit = (): void => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  const zoomToNativeSize = (): void => {
    if (!naturalSize || !baseSize) return
    setScale(clampScale(naturalSize.width / baseSize.width))
  }

  return {
    containerRef,
    scale,
    setScale: (value) => setScale(clampScale(value)),
    pan,
    isDragging,
    baseSize,
    handlePointerDown,
    handlePointerMove,
    stopDragging,
    handleImageLoad,
    zoomToFit,
    zoomToNativeSize,
    zoomOut: () => setScale((prev) => clampScale(prev - SCALE_STEP)),
    zoomIn: () => setScale((prev) => clampScale(prev + SCALE_STEP)),
    min: MIN_SCALE,
    max: MAX_SCALE
  }
}
