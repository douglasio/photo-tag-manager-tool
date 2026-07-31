import type { UsePannableZoomResult } from '@hooks'
import { Box, Text } from '@mantine/core'
import type { ReactElement } from 'react'

import { PannableZoomableImage } from '@components'
import type { PhotoRecord } from '@shared/types'
import { formatDateTaken } from '@utils'

interface NewspaperCoverViewProps {
  photo: PhotoRecord
  // Owned by PhotoView so it can render the matching ZoomToolbar in its own
  // footer bar instead of a separate floating one here.
  zoom: UsePannableZoomResult
  // Global masthead text, editable in Settings.
  mastheadTitle: string
}

// Playfair Display (self-hosted via @fontsource/playfair-display, imported
// once in main.tsx) is the bold editorial serif real newspaper mastheads and
// headlines use — Mantine's theme sans doesn't have anything like it.
const SERIF_FONT = "'Playfair Display', serif"
const PAPER_COLOR = '#f4f1ea'
const INK_COLOR = '#1a1a1a'
// The photo itself goes grayscale to match the newsprint concept; contrast
// is nudged up slightly since straight grayscale alone tends to look flat.
const NEWSPRINT_FILTER = 'grayscale(1) contrast(1.15) brightness(0.97)'
// Taller than the magazine's 3:4 — closer to a folded broadsheet/tabloid.
const COVER_ASPECT_RATIO = '5 / 7'

// Renders the photo as a black-and-white newspaper front page — masthead,
// dateline, photo "box," and a headline/caption below it (rather than
// overlaid on the image, like a real front-page cutline) — reusing
// PannableZoomableImage for the drag-to-pan + wheel-to-zoom photo.
export function NewspaperCoverView({
  photo,
  zoom,
  mastheadTitle
}: NewspaperCoverViewProps): ReactElement {
  const title = photo.fileName.replace(/\.[^./]+$/, '')
  const dateDisplay = photo.metadata.dateTaken
    ? formatDateTaken(photo.metadata.dateTaken, 'dateOnly')
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
        display="flex"
        bg={PAPER_COLOR}
        style={{
          flexDirection: 'column',
          aspectRatio: COVER_ASPECT_RATIO,
          height: '100%',
          width: 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
          outline: '1px solid rgba(0, 0, 0, 0.15)',
          outlineOffset: -1
        }}
      >
        {/* Masthead */}
        <Box
          px="md"
          pt="sm"
          pb={4}
          style={{
            textAlign: 'center',
            borderBottom: `3px double ${INK_COLOR}`,
            flexShrink: 0
          }}
        >
          <Text
            c={INK_COLOR}
            style={{
              fontFamily: SERIF_FONT,
              fontWeight: 900,
              fontSize: '2.25rem',
              lineHeight: 1.05
            }}
          >
            {mastheadTitle}
          </Text>
          <Box
            display="flex"
            mt={4}
            pt={2}
            style={{ justifyContent: 'space-between', borderTop: `1px solid ${INK_COLOR}` }}
          >
            <Text c={INK_COLOR} fz={10} tt="uppercase" fw={600} style={{ letterSpacing: 1 }}>
              {dateDisplay ?? 'Undated'}
            </Text>
            <Text
              c={INK_COLOR}
              fz={10}
              tt="uppercase"
              fw={600}
              fs="italic"
              style={{ letterSpacing: 1 }}
            >
              Photo Edition
            </Text>
            <Text c={INK_COLOR} fz={10} tt="uppercase" fw={600} style={{ letterSpacing: 1 }}>
              Vol. I
            </Text>
          </Box>
        </Box>

        {/* Photo (grayscale) */}
        <Box pos="relative" flex={1} mih={0} m="sm" style={{ border: `1px solid ${INK_COLOR}` }}>
          <PannableZoomableImage
            photo={photo}
            zoom={zoom}
            hideToolbar
            imageFilter={NEWSPRINT_FILTER}
          />
        </Box>

        {/* Headline / caption */}
        <Box px="md" pb="md" pt={4} style={{ flexShrink: 0, borderTop: `1px solid ${INK_COLOR}` }}>
          <Text
            c={INK_COLOR}
            tt="uppercase"
            style={{
              fontFamily: SERIF_FONT,
              fontWeight: 900,
              fontSize: '1.75rem',
              lineHeight: 1.05
            }}
          >
            {title}
          </Text>
          {photo.metadata.comment && (
            <Text c={INK_COLOR} fz="sm" fs="italic" mt={4} style={{ fontFamily: SERIF_FONT }}>
              {photo.metadata.comment}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  )
}
