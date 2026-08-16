import { type ReactElement, useLayoutEffect } from 'react'

import type { UsePannableZoomResult } from '@hooks'
import { Box, Text } from '@mantine/core'

import { PannableZoomableImage } from '@components'
import { useLazyFonts, usePannableZoom } from '@hooks'
import type { PhotoRecord } from '@shared/types'

import { CoverLoadingPlaceholder } from './CoverLoadingPlaceholder'

interface MovieTheaterViewProps {
  photo: PhotoRecord
  // Owns its zoom locally (see usePannableZoom below) and reports it here so
  // PhotoView's single footer ZoomToolbar can render from the same instance.
  onZoomReady: (zoom: UsePannableZoomResult) => void
  // Reuses the DVD cover's "production studio" text for the marquee credit
  // line — both are already the same "our production company" brand, so a
  // second customizable string would just duplicate it.
  studioName: string
}

// Anton (already lazy-loaded for the DVD cover) is a heavy poster/marquee
// display face — the same personality real cinema marquees use.
const DISPLAY_FONT = "'Anton', sans-serif"
const CURTAIN_RED = '#4a0e14'
const CURTAIN_WIDTH = '13%'
// An anamorphic widescreen ratio — real "cinematic" crops land close to this.
const SCREEN_ASPECT_RATIO = '2.35 / 1'
// A warm, contrasty grade rather than the source photo shown flat — real
// color grading pushes shadows/highlights apart and warms skin/midtones.
const CINEMATIC_FILTER = 'contrast(1.18) saturate(1.15) sepia(0.12) brightness(0.96)'
const VIGNETTE = {
  background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)'
}
// Alternating heights read as a real crowd's silhouette rather than a
// perfectly even row of identical shapes.
const SEAT_COUNT = 11

function Curtain({ side }: { side: 'left' | 'right' }): ReactElement {
  return (
    <Box
      pos="absolute"
      top={0}
      bottom={0}
      style={{
        [side]: 0,
        width: CURTAIN_WIDTH,
        background: `repeating-linear-gradient(
          90deg,
          #6b1620 0%,
          ${CURTAIN_RED} 6%,
          #6b1620 12%
        )`,
        boxShadow:
          side === 'left'
            ? 'inset -12px 0 24px rgba(0,0,0,0.6)'
            : 'inset 12px 0 24px rgba(0,0,0,0.6)',
        pointerEvents: 'none'
      }}
    />
  )
}

// A row of seat-back silhouettes along the bottom edge, as if viewed from a
// few rows back — foreground set dressing, not interactive.
function SeatRow(): ReactElement {
  return (
    <Box
      pos="absolute"
      bottom={-6}
      left={0}
      right={0}
      display="flex"
      style={{ justifyContent: 'center', alignItems: 'flex-end', gap: 6, pointerEvents: 'none' }}
    >
      {Array.from({ length: SEAT_COUNT }, (_, index) => (
        <Box
          key={index}
          w={30}
          h={index % 3 === 0 ? 46 : 38}
          bg="#0a0a0a"
          style={{ borderRadius: '10px 10px 0 0', flexShrink: 0 }}
        />
      ))}
    </Box>
  )
}

// Renders the photo as a widescreen cinema presentation — velvet curtains
// framing a marquee-topped screen with a cinematic crop/color grade and
// vignette, and a row of seat silhouettes along the bottom as if watched
// from the audience — reusing PannableZoomableImage for the drag-to-pan +
// wheel-to-zoom screen image.
export function MovieTheaterView({
  photo,
  onZoomReady,
  studioName
}: MovieTheaterViewProps): ReactElement {
  const fontsLoaded = useLazyFonts([() => import('@fontsource/anton')])
  const zoom = usePannableZoom(photo, { defaultFit: 'cover' })
  useLayoutEffect(() => onZoomReady(zoom), [zoom, onZoomReady])
  const title = photo.fileName.replace(/\.[^./]+$/, '')

  if (!fontsLoaded) return <CoverLoadingPlaceholder />

  return (
    <Box
      h="100%"
      w="100%"
      pos="relative"
      display="flex"
      bg="#0c0c0e"
      style={{ alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      <Curtain side="left" />
      <Curtain side="right" />

      <Box
        pos="relative"
        display="flex"
        px="xl"
        style={{ flexDirection: 'column', alignItems: 'center', width: '70%' }}
      >
        {/* Marquee */}
        <Box
          w="100%"
          bg="#1a1512"
          px="md"
          py={6}
          style={{
            textAlign: 'center',
            border: '2px solid #b8933f',
            boxShadow: '0 0 20px rgba(184, 147, 63, 0.35)'
          }}
        >
          <Text
            c="#f5d78e"
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: '1.6rem',
              lineHeight: 1.05,
              letterSpacing: 1,
              wordBreak: 'break-word'
            }}
          >
            {title}
          </Text>
          <Text c="#b8933f" fz={10} fw={600} tt="uppercase" mt={2} style={{ letterSpacing: 2 }}>
            Now Showing · {studioName} Presents
          </Text>
        </Box>

        {/* Screen */}
        <Box
          pos="relative"
          mt="md"
          w="100%"
          style={{
            aspectRatio: SCREEN_ASPECT_RATIO,
            boxShadow: '0 0 60px rgba(0, 0, 0, 0.8), 0 0 100px 20px rgba(255, 240, 210, 0.06)'
          }}
        >
          <PannableZoomableImage
            photo={photo}
            zoom={zoom}
            hideToolbar
            imageFilter={CINEMATIC_FILTER}
          />
          <Box pos="absolute" inset={0} style={{ ...VIGNETTE, pointerEvents: 'none' }} />
        </Box>
      </Box>

      <SeatRow />
    </Box>
  )
}
