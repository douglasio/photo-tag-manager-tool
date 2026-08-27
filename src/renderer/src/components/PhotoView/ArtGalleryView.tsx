import { type ReactElement, type ReactNode, useLayoutEffect } from 'react'

import type { UsePannableZoomResult } from '@hooks'
import { Box, Image, Text } from '@mantine/core'

import { PannableZoomableImage } from '@components'
import { useLazyFonts, usePannableZoom } from '@hooks'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { formatDateTaken, isPhotoDisplayable } from '@utils'

import { CoverLoadingPlaceholder } from './CoverLoadingPlaceholder'

interface ArtGalleryViewProps {
  photo: PhotoRecord
  // Owns its zoom locally (see usePannableZoom below) and reports it here so
  // PhotoView's single footer ZoomToolbar can render from the same instance.
  onZoomReady: (zoom: UsePannableZoomResult) => void
  // Global gallery name text, editable in Settings — shown on the placard's
  // credit line, the same role mastheadTitle/studioName play elsewhere.
  galleryName: string
}

// Playfair Display (also lazy-loaded for the newspaper's headlines) carries
// a real museum placard's serif typography well.
const SERIF_FONT = "'Playfair Display', serif"
const WALL_COLOR = '#2b2926'
const FRAME_COLOR = '#181614'
const MAT_COLOR = '#f2efe6'
// A common matted-print portrait ratio.
const FRAME_ASPECT_RATIO = '4 / 5'
const FRAME_THICKNESS = 16
const MAT_THICKNESS = 32
const FRAME_SHADOW = '0 24px 64px rgba(0, 0, 0, 0.7)'
const DIMMED_FILTER = 'brightness(0.6) saturate(0.75) blur(0.5px)'
// A soft spotlight from above, the way gallery track lighting actually
// pools on a wall-mounted piece rather than lighting the whole room evenly.
const SPOTLIGHT = {
  background: 'radial-gradient(ellipse 55% 45% at 50% 0%, rgba(255,255,255,0.16), transparent 70%)'
}

interface FrameProps {
  height: string
  dimmed?: boolean
  children: ReactNode
}

// The shared frame + mat shell for a hung piece — the main photo (its own
// pannable/zoomable image) and each smaller SidePiece (a plain static
// thumbnail) both render through this instead of duplicating the same
// frame/mat markup twice.
function Frame({ height, dimmed, children }: FrameProps): ReactElement {
  return (
    <Box
      bg={FRAME_COLOR}
      style={{
        aspectRatio: FRAME_ASPECT_RATIO,
        height,
        width: 'auto',
        flexShrink: 0,
        padding: FRAME_THICKNESS,
        boxShadow: FRAME_SHADOW,
        filter: dimmed ? DIMMED_FILTER : undefined
      }}
    >
      <Box
        h="100%"
        w="100%"
        bg={MAT_COLOR}
        style={{ padding: MAT_THICKNESS, boxShadow: 'inset 0 0 12px rgba(0, 0, 0, 0.25)' }}
      >
        {children}
      </Box>
    </Box>
  )
}

// A smaller, dimmed piece hanging on the same wall beside the main one — a
// real other photo from the library, in its own frame and mat like the main
// piece (just smaller/secondary), not a randomly floating background layer.
function SidePiece({ photo }: { photo: PhotoRecord }): ReactElement | null {
  if (!photo.thumbnailKey) return null
  return (
    <Box
      h="100%"
      display="flex"
      style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <Frame height="46%" dimmed>
        <Image
          src={toThumbProtocolUrl(photo.thumbnailKey)}
          alt={photo.fileName}
          h="100%"
          w="100%"
          fit="cover"
        />
      </Frame>
      <Box
        mt="sm"
        px="sm"
        py={4}
        bg={MAT_COLOR}
        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)' }}
      >
        <Box w={60} h={6} bg="#c9c4b6" />
      </Box>
    </Box>
  )
}

// Renders the photo as a matted, framed print hanging on a gallery wall,
// with (when the library has other photos) a couple of them hanging beside
// it in the same row — smaller and dimmed, like real secondary pieces on a
// curated wall — dark wall, soft overhead spotlight, a museum-style placard
// under the main piece — reusing PannableZoomableImage for the drag-to-pan +
// wheel-to-zoom main print itself.
export function ArtGalleryView({
  photo,
  onZoomReady,
  galleryName
}: ArtGalleryViewProps): ReactElement {
  const fontsLoaded = useLazyFonts([
    () => import('@fontsource/playfair-display/400.css'),
    () => import('@fontsource/playfair-display/400-italic.css'),
    () => import('@fontsource/playfair-display/700.css'),
    () => import('@fontsource/playfair-display/900.css')
  ])
  const zoom = usePannableZoom(photo, { defaultFit: 'cover' })
  useLayoutEffect(() => onZoomReady(zoom), [zoom, onZoomReady])
  const { visiblePhotos } = usePhotoLibrary()
  const title = photo.fileName.replace(/\.[^./]+$/, '')
  const dateDisplay = photo.metadata.dateTaken ? formatDateTaken(photo.metadata.dateTaken) : null

  const otherPhotos = visiblePhotos
    .filter((p) => p.filePath !== photo.filePath && isPhotoDisplayable(p))
    .slice(0, 2)

  if (!fontsLoaded) return <CoverLoadingPlaceholder />

  return (
    <Box
      h="100%"
      w="100%"
      pos="relative"
      display="flex"
      p="xl"
      bg={WALL_COLOR}
      style={{ alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      <Box pos="absolute" inset={0} style={{ ...SPOTLIGHT, pointerEvents: 'none' }} />

      <Box
        h="100%"
        display="flex"
        style={{ alignItems: 'center', justifyContent: 'center', gap: 28 }}
      >
        {otherPhotos[0] && <SidePiece photo={otherPhotos[0]} />}

        <Box
          h="100%"
          display="flex"
          style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
          <Frame height="70%">
            <PannableZoomableImage photo={photo} zoom={zoom} hideToolbar />
          </Frame>

          {/* Placard */}
          <Box
            mt="lg"
            px="lg"
            py="sm"
            bg={MAT_COLOR}
            style={{ textAlign: 'center', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)' }}
          >
            <Text
              fs="italic"
              fw={600}
              style={{ fontFamily: SERIF_FONT, fontSize: '1.1rem', color: '#1a1a1a' }}
            >
              {title}
            </Text>
            <Text fz="xs" mt={2} style={{ fontFamily: SERIF_FONT, color: '#3a3a3a' }}>
              {dateDisplay ?? 'Undated'}
            </Text>
            <Text
              fz={9}
              mt={4}
              tt="uppercase"
              style={{ fontFamily: SERIF_FONT, letterSpacing: 1, color: '#6b6b6b' }}
            >
              Archival pigment print · Courtesy of {galleryName}
            </Text>
          </Box>
        </Box>

        {otherPhotos[1] && <SidePiece photo={otherPhotos[1]} />}
      </Box>
    </Box>
  )
}
