import { Box, Text } from '@mantine/core'
import type { ReactElement } from 'react'
import type { PhotoRecord } from '../../../../shared/types'
import { toDisplayMetadata } from '../../utils/metadataDisplay'
import type { UsePannableZoomResult } from '../../hooks/usePannableZoom'
import { PannableZoomableImage } from '../Shared/PannableZoomableImage'
import { CoverBarcode } from '../Shared/CoverBarcode'

interface DvdCoverViewProps {
  photo: PhotoRecord
  // Owned by PhotoView so it can render the matching ZoomToolbar in its own
  // footer bar instead of a separate floating one here.
  zoom: UsePannableZoomResult
  // Global "production studio" text, editable in Settings.
  studioName: string
}

// Anton (self-hosted via @fontsource/anton, imported once in main.tsx) is a
// heavier, more block-poster display face than the magazine's Bebas Neue or
// the newspaper's Playfair Display — a third distinct type personality.
const DISPLAY_FONT = "'Anton', sans-serif"
const CASE_COLOR = '#111214'
const SILVER = '#c9ccd1'
const TEXT_SHADOW = '0 2px 10px rgba(0, 0, 0, 0.9)'
// A DVD/Blu-ray keepcase's front-panel proportions (portrait), spine included.
const COVER_ASPECT_RATIO = '4 / 5'
const SPINE_WIDTH = '11%'
// Punchier than the source photo, like real cover art retouching.
const COVER_IMAGE_FILTER = 'saturate(1.3) contrast(1.15) brightness(1.02)'

function TechSpecs({ photo }: { photo: PhotoRecord }): ReactElement {
  const display = toDisplayMetadata(photo.metadata)
  const specs = [display.format.displayValue, `${display.widthPx.displayValue}`, 'STEREO']
  return (
    <Box display="flex" style={{ gap: 10, alignItems: 'center' }}>
      {specs.map((spec) => (
        <Box key={spec} px={6} py={2} style={{ border: `1px solid ${SILVER}`, borderRadius: 3 }}>
          <Text c={SILVER} fz={9} fw={700} tt="uppercase" style={{ letterSpacing: 1 }}>
            {spec}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

// Renders the photo as a DVD/Blu-ray keepcase — a dark plastic-case spine
// (title running down its length, like a shelf view) alongside the front
// cover art with a bold title, tagline, "starring" cast line (from the
// photo's own tags), technical specs strip and barcode — reusing
// PannableZoomableImage for the drag-to-pan + wheel-to-zoom photo, scoped to
// the front panel only.
export function DvdCoverView({ photo, zoom, studioName }: DvdCoverViewProps): ReactElement {
  const title = photo.fileName.replace(/\.[^./]+$/, '')

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
        display="flex"
        bg={CASE_COLOR}
        style={{
          aspectRatio: COVER_ASPECT_RATIO,
          height: '100%',
          width: 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.55)',
          outline: '1px solid rgba(255, 255, 255, 0.15)',
          outlineOffset: -1
        }}
      >
        {/* Spine */}
        <Box
          style={{
            flexShrink: 0,
            width: SPINE_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 0',
            borderRight: `1px solid rgba(255, 255, 255, 0.15)`,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.05), transparent)'
          }}
        >
          <Text c={SILVER} fz={7} fw={700} style={{ letterSpacing: 1, writingMode: 'vertical-rl' }}>
            {studioName}
          </Text>
          <Text
            c="white"
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: '1rem',
              letterSpacing: 1,
              writingMode: 'vertical-rl',
              whiteSpace: 'nowrap'
            }}
          >
            {title}
          </Text>
        </Box>

        {/* Front cover */}
        <Box pos="relative" flex={1} mih={0}>
          <PannableZoomableImage
            photo={photo}
            zoom={zoom}
            hideToolbar
            imageFilter={COVER_IMAGE_FILTER}
            overlay={
              <Box
                h="100%"
                w="100%"
                display="flex"
                style={{ flexDirection: 'column', justifyContent: 'space-between' }}
              >
                {/* Title */}
                <Box
                  px="sm"
                  pt="sm"
                  pb="xs"
                  style={{
                    textAlign: 'center',
                    background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.7), transparent)'
                  }}
                >
                  <Text
                    c="white"
                    style={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: '2.5rem',
                      lineHeight: 0.95,
                      letterSpacing: 1,
                      textShadow: TEXT_SHADOW,
                      wordBreak: 'break-word'
                    }}
                  >
                    {title}
                  </Text>
                </Box>

                {/* Tagline / cast / specs */}
                <Box
                  px="sm"
                  pb="sm"
                  pt={6}
                  style={{
                    background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 45%, transparent)',
                    borderTop: `2px solid ${SILVER}`
                  }}
                >
                  {photo.metadata.comment && (
                    <Text
                      c="white"
                      fs="italic"
                      fz="sm"
                      fw={600}
                      mb={6}
                      style={{ textShadow: TEXT_SHADOW }}
                    >
                      “{photo.metadata.comment}”
                    </Text>
                  )}
                  {photo.tags.length > 0 && (
                    <Text
                      c={SILVER}
                      fz={10}
                      fw={700}
                      tt="uppercase"
                      mb={8}
                      style={{ letterSpacing: 1 }}
                    >
                      Starring {photo.tags.slice(0, 4).join(', ')}
                    </Text>
                  )}
                  <Box
                    display="flex"
                    style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}
                  >
                    <TechSpecs photo={photo} />
                    <CoverBarcode />
                  </Box>
                </Box>
              </Box>
            }
          />
        </Box>
      </Box>
    </Box>
  )
}
