import { Box, Text } from '@mantine/core'
import type { ReactElement } from 'react'
import type { PhotoRecord } from '../../../../shared/types'
import { formatDateTaken } from '../../utils/metadataDisplay'
import type { UsePannableZoomResult } from '../../hooks/usePannableZoom'
import { PannableZoomableImage } from '../Shared/PannableZoomableImage'
import { CoverBarcode } from '../Shared/CoverBarcode'

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
// Sports Illustrated / People-style punchy red + yellow, rather than a
// single muted accent.
const ACCENT_RED = '#e0122c'
const ACCENT_YELLOW = '#ffde59'
const TEXT_SHADOW = '0 2px 10px rgba(0, 0, 0, 0.9)'
// A classic magazine trim proportion (width:height), portrait.
const COVER_ASPECT_RATIO = '3 / 4'
// Punchier, more saturated/contrasty than the source photo — real cover
// photography is always retouched for pop, not shown flat.
const COVER_IMAGE_FILTER = 'saturate(1.35) contrast(1.12) brightness(1.03)'

// The circular "burst" sticker real covers (SI's swimsuit issue, People's
// "special") pin to a top corner — tilted, bold, high-contrast.
function CoverBurst(): ReactElement {
  return (
    <Box
      pos="absolute"
      top={14}
      right={14}
      w={72}
      h={72}
      bg={ACCENT_RED}
      style={{
        borderRadius: '50%',
        border: '2px solid white',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
        transform: 'rotate(12deg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center'
      }}
    >
      <Text
        c="white"
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: '1.05rem',
          lineHeight: 0.95,
          letterSpacing: 1
        }}
      >
        PHOTO
        <br />
        EDITION
      </Text>
    </Box>
  )
}

// Small colored pills teasing the photo's own tags, People-style "also in
// this issue" — real data, not invented cover lines.
function TagTeasers({ tags }: { tags: string[] }): ReactElement | null {
  if (tags.length === 0) return null
  return (
    <Box display="flex" mt={6} style={{ justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
      {tags.slice(0, 3).map((tag, index) => (
        <Box
          key={tag}
          px={8}
          py={2}
          bg={index % 2 === 0 ? ACCENT_YELLOW : ACCENT_RED}
          style={{ borderRadius: 999, transform: `rotate(${index % 2 === 0 ? -2 : 2}deg)` }}
        >
          <Text
            c={index % 2 === 0 ? 'black' : 'white'}
            fw={700}
            fz={10}
            tt="uppercase"
            style={{ letterSpacing: 0.5, whiteSpace: 'nowrap' }}
          >
            {tag}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

// Renders the photo inside a portrait, magazine-cover-shaped frame — a bold
// masthead, corner burst, tag teasers, headline and barcode overlaid like a
// real newsstand cover's furniture — reusing PannableZoomableImage for the
// drag-to-pan + wheel-to-zoom background, scoped to the frame rather than
// the whole PhotoView area.
export function MagazineCoverView({
  photo,
  zoom,
  mastheadTitle
}: MagazineCoverViewProps): ReactElement {
  const title = photo.fileName.replace(/\.[^./]+$/, '')
  const dateDisplay = photo.metadata.dateTaken
    ? formatDateTaken(photo.metadata.dateTaken, 'monthYear')
    : null

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
              style={{ flexDirection: 'column', justifyContent: 'space-between' }}
            >
              {/* Masthead */}
              <Box
                pt="md"
                pb="xs"
                px="md"
                style={{
                  textAlign: 'center',
                  background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.65), transparent)'
                }}
              >
                <Text
                  c={ACCENT_RED}
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: '2.75rem',
                    lineHeight: 1,
                    letterSpacing: 2,
                    textShadow: TEXT_SHADOW,
                    WebkitTextStroke: '1.5px black'
                  }}
                >
                  {mastheadTitle}
                </Text>
                {dateDisplay && (
                  <Text
                    c="white"
                    fz="xs"
                    fw={700}
                    tt="uppercase"
                    style={{ letterSpacing: 3, textShadow: TEXT_SHADOW }}
                  >
                    {dateDisplay}
                  </Text>
                )}
                <TagTeasers tags={photo.tags} />
              </Box>

              <CoverBurst />

              {/* Cover lines */}
              <Box
                pos="relative"
                pb="lg"
                px="md"
                pt={6}
                style={{
                  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.92) 40%, transparent)',
                  borderTop: `4px solid ${ACCENT_RED}`
                }}
              >
                <Text
                  c="white"
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: '3.75rem',
                    lineHeight: 0.9,
                    letterSpacing: 1,
                    textShadow: TEXT_SHADOW,
                    WebkitTextStroke: '1.5px black',
                    wordBreak: 'break-word'
                  }}
                >
                  {title}
                </Text>
                {photo.metadata.comment && (
                  <Text
                    c={ACCENT_YELLOW}
                    fs="italic"
                    fz="md"
                    fw={700}
                    mt={4}
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
