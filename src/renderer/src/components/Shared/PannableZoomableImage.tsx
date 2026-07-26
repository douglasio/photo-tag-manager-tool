import { Box, Flex, Image } from '@mantine/core'
import type { ReactElement, ReactNode } from 'react'
import type { PhotoRecord } from '../../../../shared/types'
import { toFileProtocolUrl } from '../../../../shared/protocolUrls'
import type { UsePannableZoomResult } from '../../hooks/usePannableZoom'
import { ZoomToolbar } from './ZoomToolbar'

interface PannableZoomableImageProps {
  photo: PhotoRecord
  // Owned by the caller (usePannableZoom) rather than internally, so a
  // parent that wants to render the zoom controls itself elsewhere — e.g.
  // PhotoView's magazine mode, in its own footer bar — stays in sync with
  // what's actually displayed here instead of driving a second, disconnected
  // copy of the same state.
  zoom: UsePannableZoomResult
  // Rendered as a non-interactive layer above the image (below the zoom
  // toolbar) — used by MagazineCoverView to lay text over the pannable image
  // without it dragging along with pan/zoom.
  overlay?: ReactNode
  // Suppresses the built-in floating toolbar when the caller renders
  // ZoomToolbar itself instead (see `zoom` above).
  hideToolbar?: boolean
  // CSS filter applied to the image itself — e.g. NewspaperCoverView passes
  // grayscale() to match the newsprint concept.
  imageFilter?: string
}

// A drag-to-pan + wheel-to-zoom image frame — used by the compare view (one
// pane each, own inline toolbar) and reused by MagazineCoverView for its
// background image (toolbar rendered by PhotoView instead). Deliberately
// simpler than PhotoView's own standard-view zoom (no entrance animation, no
// EXIF-rotation aspect-ratio probe).
export function PannableZoomableImage({
  photo,
  zoom,
  overlay,
  hideToolbar,
  imageFilter
}: PannableZoomableImageProps): ReactElement {
  const { containerRef, scale, pan, isDragging, baseSize } = zoom

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
        onPointerDown={zoom.handlePointerDown}
        onPointerMove={zoom.handlePointerMove}
        onPointerUp={zoom.stopDragging}
        onPointerCancel={zoom.stopDragging}
      >
        <Image
          src={toFileProtocolUrl(photo.filePath, photo.thumbnailKey)}
          alt={photo.fileName}
          onLoad={zoom.handleImageLoad}
          draggable={false}
          w={baseSize?.width}
          h={baseSize?.height}
          style={{
            visibility: baseSize ? 'visible' : 'hidden',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center',
            filter: imageFilter,
            userSelect: 'none',
            WebkitUserDrag: 'none'
          }}
        />
      </Box>
      {overlay && (
        <Box pos="absolute" inset={0} style={{ pointerEvents: 'none' }}>
          {overlay}
        </Box>
      )}
      {!hideToolbar && (
        <Flex pos="absolute" bottom={0} left={0} right={0} justify="flex-end" p="md">
          <ZoomToolbar
            scale={scale}
            onScaleChange={zoom.setScale}
            onZoomToFit={zoom.zoomToFit}
            onZoomToNativeSize={zoom.zoomToNativeSize}
            onZoomOut={zoom.zoomOut}
            onZoomIn={zoom.zoomIn}
            min={zoom.min}
            max={zoom.max}
          />
        </Flex>
      )}
    </Box>
  )
}
