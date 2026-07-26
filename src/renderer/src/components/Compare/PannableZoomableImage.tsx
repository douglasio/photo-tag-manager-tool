import { Box, Flex, Image } from '@mantine/core'
import { useEffect, useRef, useState, type PointerEvent, type ReactElement } from 'react'
import type { PhotoRecord } from '../../../../shared/types'
import { toFileProtocolUrl } from '../../../../shared/protocolUrls'
import { ZoomToolbar } from '../Shared/ZoomToolbar'

const MIN_SCALE = 0.5
const MAX_SCALE = 5
const SCALE_STEP = 0.25
const WHEEL_ZOOM_SENSITIVITY = 0.0025

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

interface PannableZoomableImageProps {
  photo: PhotoRecord
}

// A self-contained drag-to-pan + wheel-to-zoom image frame for the compare
// view — independent per pane, deliberately simpler than PhotoView's zoom
// (no entrance animation, no EXIF-rotation aspect-ratio probe).
export function PannableZoomableImage({ photo }: PannableZoomableImageProps): ReactElement {
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragOrigin = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 })

  // The image renders at this fixed pixel size (adjusted only by `scale`)
  // rather than a percentage-based maw/mah + object-fit, which would
  // otherwise recompute — and visibly resize the image — every time the
  // Splitter handle moves. Computed once from the pane's size at load time,
  // like object-fit: contain would, but then held fixed. naturalSize is kept
  // alongside it so "Original size" can invert exactly the same fit ratio,
  // matching PhotoView's zoomToNativeSize.
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)

  // Reset pan/zoom/base-size whenever the compared photo changes, adjusted
  // during render per this codebase's convention for resetting state on
  // prop change.
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

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOrigin.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y
    }
    setIsDragging(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!isDragging) return
    const { startX, startY, originX, originY } = dragOrigin.current
    setPan({ x: originX + (event.clientX - startX), y: originY + (event.clientY - startY) })
  }

  const stopDragging = (): void => setIsDragging(false)

  const zoomToFit = (): void => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  const zoomToNativeSize = (): void => {
    if (!naturalSize || !baseSize) return
    setScale(clampScale(naturalSize.width / baseSize.width))
  }

  return (
    <Box ref={containerRef} pos="relative" h="100%" w="100%" style={{ overflow: 'hidden' }}>
      <Box
        h="100%"
        w="100%"
        display="flex"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <Image
          src={toFileProtocolUrl(photo.filePath, photo.thumbnailKey)}
          alt={photo.fileName}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            const container = containerRef.current
            if (!container || !naturalWidth || !naturalHeight) return
            setNaturalSize({ width: naturalWidth, height: naturalHeight })
            const containScale = Math.min(
              1,
              container.clientWidth / naturalWidth,
              container.clientHeight / naturalHeight
            )
            setBaseSize({
              width: naturalWidth * containScale,
              height: naturalHeight * containScale
            })
            // Default to filling the pane (like object-fit: cover) rather
            // than letterboxing, by pre-zooming up from the contain baseline.
            const coverScale = Math.max(
              container.clientWidth / naturalWidth,
              container.clientHeight / naturalHeight
            )
            setScale(clampScale(coverScale / containScale))
          }}
          draggable={false}
          w={baseSize?.width}
          h={baseSize?.height}
          style={{
            visibility: baseSize ? 'visible' : 'hidden',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center',
            userSelect: 'none',
            WebkitUserDrag: 'none'
          }}
        />
      </Box>
      <Flex pos="absolute" bottom={0} left={0} right={0} justify="flex-end" p="sm">
        <ZoomToolbar
          scale={scale}
          onScaleChange={setScale}
          onZoomToFit={zoomToFit}
          onZoomToNativeSize={zoomToNativeSize}
          onZoomOut={() => setScale((prev) => clampScale(prev - SCALE_STEP))}
          onZoomIn={() => setScale((prev) => clampScale(prev + SCALE_STEP))}
          min={MIN_SCALE}
          max={MAX_SCALE}
        />
      </Flex>
    </Box>
  )
}
