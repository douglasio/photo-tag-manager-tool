import { Box, Text } from '@mantine/core'
import type { ReactElement } from 'react'
import type { PhotoRecord } from '../../../../shared/types'
import { formatDateTaken } from '../../utils/metadataDisplay'
import type { UsePannableZoomResult } from '../../hooks/usePannableZoom'
import { PannableZoomableImage } from '../Shared/PannableZoomableImage'

interface MagazineCoverViewProps {
  photo: PhotoRecord
  // Owned by PhotoView so it can render the matching ZoomToolbar in its own
  // footer bar instead of a separate floating one here.
  zoom: UsePannableZoomResult
  // Global masthead text, editable in Settings.
  mastheadTitle: string
}

// Bebas Neue (self-hosted via @fontsource/bebas-neue, imported once in
// main.tsx) is the tall, condensed display face real magazine mastheads and
// cover lines use — Mantine's theme sans doesn't have anything like it.
const DISPLAY_FONT = "'Bebas Neue', sans-serif"
const ACCENT_COLOR = '#ffde59'
const TEXT_SHADOW = '0 2px 10px rgba(0, 0, 0, 0.85)'
// A classic magazine trim proportion (width:height), portrait.
const COVER_ASPECT_RATIO = '3 / 4'

// A repeating-gradient barcode — the corner decoration nearly every real
// magazine cover carries — purely decorative, no real data encoded.
function CoverBarcode(): ReactElement {
  return (
    <Box bg="white" p={4} style={{ display: 'inline-block' }}>
      <Box
        w={44}
        h={26}
        style={{
          background:
            'repeating-linear-gradient(90deg, #000 0, #000 2px, #fff 2px, #fff 3px, #000 3px, #000 4px, #fff 4px, #fff 6px)'
        }}
      />
      <Text c="black" fz={8} ta="center" style={{ fontFamily: DISPLAY_FONT, letterSpacing: 1 }}>
        01
      </Text>
    </Box>
  )
}

// Renders the photo inside a portrait, magazine-cover-shaped frame — a
// masthead, kicker, headline, subtitle and barcode overlaid like a real
// cover's furniture — reusing PannableZoomableImage for the drag-to-pan +
// wheel-to-zoom background, scoped to the frame rather than the whole
// PhotoView area.
export function MagazineCoverView({
  photo,
  zoom,
  mastheadTitle
}: MagazineCoverViewProps): ReactElement {
  const title = photo.fileName.replace(/\.[^./]+$/, '')
  const dateDisplay = photo.metadata.dateTaken ? formatDateTaken(photo.metadata.dateTaken) : null

  return (
    <Box
      h="100%"
      w="100%"
      display="flex"
      p="xl"
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <Box
        pos="relative"
        style={{
          aspectRatio: COVER_ASPECT_RATIO,
          height: '100%',
          width: 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
          outline: '1px solid rgba(255, 255, 255, 0.25)',
          outlineOffset: -1
        }}
      >
        <PannableZoomableImage
          photo={photo}
          zoom={zoom}
          hideToolbar
          overlay={
            <Box
              h="100%"
              w="100%"
              display="flex"
              style={{ flexDirection: 'column', justifyContent: 'space-between' }}
            >
              {/* Masthead */}
              <Box
                pt="md"
                pb="xs"
                px="md"
                style={{
                  textAlign: 'center',
                  background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.55), transparent)'
                }}
              >
                <Text
                  c="white"
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: '2.25rem',
                    lineHeight: 1,
                    letterSpacing: 4,
                    textShadow: TEXT_SHADOW
                  }}
                >
                  {mastheadTitle}
                </Text>
                {dateDisplay && (
                  <Text
                    c={ACCENT_COLOR}
                    fz="xs"
                    fw={700}
                    tt="uppercase"
                    style={{ letterSpacing: 3, textShadow: TEXT_SHADOW }}
                  >
                    {dateDisplay}
                  </Text>
                )}
              </Box>

              {/* Cover lines */}
              <Box
                pos="relative"
                pb="lg"
                px="md"
                style={{ background: 'linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent)' }}
              >
                <Text
                  c="white"
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: '3.25rem',
                    lineHeight: 0.95,
                    letterSpacing: 1,
                    textShadow: TEXT_SHADOW,
                    WebkitTextStroke: '1px rgba(0, 0, 0, 0.4)',
                    wordBreak: 'break-word'
                  }}
                >
                  {title}
                </Text>
                {photo.metadata.comment && (
                  <Text
                    c="white"
                    fs="italic"
                    fz="md"
                    mt={4}
                    fw={500}
                    style={{ textShadow: TEXT_SHADOW }}
                  >
                    “{photo.metadata.comment}”
                  </Text>
                )}
                <Box pos="absolute" bottom={10} right={10}>
                  <CoverBarcode />
                </Box>
              </Box>
            </Box>
          }
        />
      </Box>
    </Box>
  )
}
