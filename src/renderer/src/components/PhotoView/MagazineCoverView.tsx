import type { UsePannableZoomResult } from '@hooks'
import { Box, Text } from '@mantine/core'
import type { ReactElement } from 'react'

import { CoverBarcode, PannableZoomableImage } from '@components'
import { useLazyFonts } from '@hooks'
import type { PhotoRecord } from '@shared/types'
import { formatDateTaken } from '@utils'

import { CoverLoadingPlaceholder } from './CoverLoadingPlaceholder'

interface MagazineCoverViewProps {
  photo: PhotoRecord
  // Owned by PhotoView so it can render the matching ZoomToolbar in its own
  // footer bar instead of a separate floating one here.
  zoom: UsePannableZoomResult
  // Global masthead text, editable in Settings.
  mastheadTitle: string
}

// Bebas Neue (self-hosted via @fontsource/bebas-neue, lazy-loaded below) is
// the tall, condensed display face real magazine mastheads/cover lines use.
const DISPLAY_FONT = "'Bebas Neue', sans-serif"
// One restrained accent, used sparingly (a rule, a single teaser) — real
// newsstand covers lean on clean white/black type for legibility and use
// color as a small accent, not as the dominant surface.
const ACCENT = '#c81e3a'
const TEXT_SHADOW = '0 1px 6px rgba(0, 0, 0, 0.85)'
// A classic magazine trim proportion (width:height), portrait.
const COVER_ASPECT_RATIO = '3 / 4'
// Punchier, more saturated/contrasty than the source photo — real cover
// photography is always retouched for pop, not shown flat.
const COVER_IMAGE_FILTER = 'saturate(1.25) contrast(1.08) brightness(1.02)'

// The small, numerous cover lines real newsstand covers run down one edge —
// varied size/weight rather than one giant sticker, pulled from the photo's
// own tags (real data, not invented headlines).
function CoverLines({ tags }: { tags: string[] }): ReactElement | null {
  if (tags.length === 0) return null
  return (
    <Box
      display="flex"
      style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 3, textAlign: 'right' }}
    >
      {tags.slice(0, 4).map((tag, index) => (
        <Text
          key={tag}
          c={index === 0 ? ACCENT : 'white'}
          tt="uppercase"
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: index === 0 ? '1.35rem' : '1.05rem',
            lineHeight: 1,
            letterSpacing: 0.5,
            textShadow: TEXT_SHADOW
          }}
        >
          {tag}
        </Text>
      ))}
    </Box>
  )
}

// Renders the photo inside a portrait, magazine-cover-shaped frame — a clean
// masthead, an issue line, a column of small cover lines down the right
// edge, a bottom coverline, and a barcode, the way a real newsstand cover is
// actually laid out (mostly white/black type, one restrained accent color) —
// reusing PannableZoomableImage for the drag-to-pan + wheel-to-zoom
// background, scoped to the frame rather than the whole PhotoView area.
export function MagazineCoverView({
  photo,
  zoom,
  mastheadTitle
}: MagazineCoverViewProps): ReactElement {
  const fontsLoaded = useLazyFonts([() => import('@fontsource/bebas-neue')])
  const title = photo.fileName.replace(/\.[^./]+$/, '')
  const dateDisplay = photo.metadata.dateTaken
    ? formatDateTaken(photo.metadata.dateTaken, 'monthYear')
    : null

  if (!fontsLoaded) return <CoverLoadingPlaceholder />

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
          imageFilter={COVER_IMAGE_FILTER}
          overlay={
            <Box
              h="100%"
              w="100%"
              display="flex"
              px="md"
              pt="sm"
              pb="lg"
              style={{
                flexDirection: 'column',
                justifyContent: 'space-between',
                background:
                  'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 18%, transparent 60%, rgba(0,0,0,0.85) 100%)'
              }}
            >
              {/* Masthead + issue line */}
              <Box style={{ textAlign: 'center' }}>
                <Text
                  c="white"
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: '3rem',
                    lineHeight: 1,
                    letterSpacing: 3,
                    textShadow: TEXT_SHADOW
                  }}
                >
                  {mastheadTitle}
                </Text>
                {dateDisplay && (
                  <Text
                    c="white"
                    fz={10}
                    fw={600}
                    tt="uppercase"
                    mt={2}
                    style={{ letterSpacing: 3, textShadow: TEXT_SHADOW, opacity: 0.85 }}
                  >
                    {dateDisplay}
                  </Text>
                )}
              </Box>

              {/* Cover lines, right edge */}
              <Box style={{ alignSelf: 'flex-end' }}>
                <CoverLines tags={photo.tags} />
              </Box>

              {/* Main coverline + barcode */}
              <Box>
                <Box style={{ borderTop: `2px solid ${ACCENT}`, paddingTop: 6 }}>
                  <Text
                    c="white"
                    style={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: '3.25rem',
                      lineHeight: 0.92,
                      letterSpacing: 0.5,
                      textShadow: TEXT_SHADOW,
                      wordBreak: 'break-word'
                    }}
                  >
                    {title}
                  </Text>
                  {photo.metadata.comment && (
                    <Text
                      c="white"
                      fs="italic"
                      fz="sm"
                      fw={500}
                      mt={4}
                      style={{ textShadow: TEXT_SHADOW, opacity: 0.9 }}
                    >
                      “{photo.metadata.comment}”
                    </Text>
                  )}
                </Box>
                <Box mt={10} display="flex" style={{ justifyContent: 'flex-end' }}>
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
