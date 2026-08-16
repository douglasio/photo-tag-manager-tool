import { type ReactElement, useLayoutEffect } from 'react'

import type { UsePannableZoomResult } from '@hooks'
import { Box, Text } from '@mantine/core'

import { PannableZoomableImage } from '@components'
import { useLazyFonts, usePannableZoom } from '@hooks'
import type { PhotoRecord } from '@shared/types'
import { formatDateTaken } from '@utils'

import { CoverLoadingPlaceholder } from './CoverLoadingPlaceholder'

interface NewspaperCoverViewProps {
  photo: PhotoRecord
  // Owns its zoom locally (see usePannableZoom below) and reports it here so
  // PhotoView's single footer ZoomToolbar can render from the same instance.
  onZoomReady: (zoom: UsePannableZoomResult) => void
  // Global masthead text, editable in Settings.
  mastheadTitle: string
}

// UnifrakturMaguntia (self-hosted, lazy-loaded below) is a genuine blackletter
// face — real broadsheet nameplates lean on this same Old English tradition.
const MASTHEAD_FONT = "'UnifrakturMaguntia', serif"
// Playfair Display carries the headline/byline/caption — a real front page
// pairs a blackletter nameplate with an ordinary (if bold) body/headline serif.
const SERIF_FONT = "'Playfair Display', serif"
const PAPER_COLOR = '#ece6d6'
const INK_COLOR = '#1a1a1a'
// The photo itself goes grayscale to match the newsprint concept; contrast
// is nudged up slightly since straight grayscale alone tends to look flat.
const NEWSPRINT_FILTER = 'grayscale(1) contrast(1.15) brightness(0.97)'
// Taller than the magazine's 3:4 — closer to a folded broadsheet/tabloid.
const COVER_ASPECT_RATIO = '5 / 7'
// A faint halftone dot-grid, the way cheap newsprint stock actually looks
// under close inspection — subtle enough to read as texture, not noise.
const PAPER_TEXTURE = {
  backgroundImage: 'radial-gradient(rgba(0, 0, 0, 0.05) 0.5px, transparent 0.5px)',
  backgroundSize: '3px 3px'
}
// Simulates fine-print body-text columns without real copy — a common
// print-mockup technique (stacked hairlines standing in for lines of type)
// that reads as "there's more paper here" at a glance, the way a real front
// page is dense with jump-heads and column text around the lead story.
const GREEKED_TEXT_LINES = {
  backgroundImage: `repeating-linear-gradient(
    to bottom,
    ${INK_COLOR} 0,
    ${INK_COLOR} 1.5px,
    transparent 1.5px,
    transparent 7px
  )`,
  opacity: 0.35
}

function ColumnFiller({ lines }: { lines: number }): ReactElement {
  return <Box h={lines * 7} style={GREEKED_TEXT_LINES} />
}

// Renders the photo as an authentic-feeling black-and-white broadsheet front
// page — blackletter nameplate, rule lines, dateline bar, headline above the
// lead photo, a cutline caption, and greeked column filler to suggest the
// rest of the page — reusing PannableZoomableImage for the drag-to-pan +
// wheel-to-zoom photo.
export function NewspaperCoverView({
  photo,
  onZoomReady,
  mastheadTitle
}: NewspaperCoverViewProps): ReactElement {
  const fontsLoaded = useLazyFonts([
    () => import('@fontsource/unifrakturmaguntia'),
    () => import('@fontsource/playfair-display/400.css'),
    () => import('@fontsource/playfair-display/400-italic.css'),
    () => import('@fontsource/playfair-display/700.css'),
    () => import('@fontsource/playfair-display/900.css')
  ])
  const zoom = usePannableZoom(photo, { defaultFit: 'cover' })
  useLayoutEffect(() => onZoomReady(zoom), [zoom, onZoomReady])
  const title = photo.fileName.replace(/\.[^./]+$/, '')
  const dateDisplay = photo.metadata.dateTaken
    ? formatDateTaken(photo.metadata.dateTaken, 'dateOnly')
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
          outlineOffset: -1,
          overflow: 'hidden',
          ...PAPER_TEXTURE
        }}
      >
        {/* Dateline bar — sits above the nameplate on a real front page. */}
        <Box
          display="flex"
          px="sm"
          pt={6}
          pb={4}
          style={{ justifyContent: 'space-between', flexShrink: 0 }}
        >
          <Text c={INK_COLOR} fz={9} tt="uppercase" fw={600} style={{ letterSpacing: 0.5 }}>
            {dateDisplay ?? 'Undated'} · Late Edition
          </Text>
          <Text c={INK_COLOR} fz={9} tt="uppercase" fw={600} style={{ letterSpacing: 0.5 }}>
            Vol. I . . . No. 1
          </Text>
          <Text c={INK_COLOR} fz={9} fw={600} style={{ letterSpacing: 0.5 }}>
            50¢
          </Text>
        </Box>

        {/* Nameplate */}
        <Box
          px="md"
          pb={2}
          style={{
            textAlign: 'center',
            borderTop: `3px double ${INK_COLOR}`,
            borderBottom: `3px double ${INK_COLOR}`,
            flexShrink: 0
          }}
        >
          <Text
            c={INK_COLOR}
            style={{
              fontFamily: MASTHEAD_FONT,
              fontSize: '3.1rem',
              lineHeight: 1.15,
              padding: '4px 0'
            }}
          >
            {mastheadTitle}
          </Text>
        </Box>
        <Box
          display="flex"
          px="sm"
          pt={2}
          pb={4}
          style={{ justifyContent: 'space-between', borderBottom: `1px solid ${INK_COLOR}` }}
        >
          <Text c={INK_COLOR} fz={8} tt="uppercase" fw={600} style={{ letterSpacing: 1.5 }}>
            All the Photos Fit to Print
          </Text>
          <Text c={INK_COLOR} fz={8} tt="uppercase" fw={600} fs="italic" style={{ opacity: 0.8 }}>
            Photo Edition
          </Text>
        </Box>

        {/* Headline, above the lead photo like a real front page. */}
        <Box px="sm" pt={6} style={{ flexShrink: 0 }}>
          <Text
            c={INK_COLOR}
            style={{
              fontFamily: SERIF_FONT,
              fontWeight: 900,
              fontSize: '1.6rem',
              lineHeight: 1.02,
              wordBreak: 'break-word'
            }}
          >
            {title}
          </Text>
          <Text
            c={INK_COLOR}
            fz={9}
            tt="uppercase"
            fw={600}
            fs="italic"
            mt={2}
            style={{ letterSpacing: 0.5, opacity: 0.75 }}
          >
            By Our Photography Staff
          </Text>
        </Box>

        {/* Lead photo (grayscale) with a cutline caption below it. */}
        <Box
          pos="relative"
          flex={1}
          mih={0}
          mx="sm"
          mt={6}
          style={{ border: `1px solid ${INK_COLOR}` }}
        >
          <PannableZoomableImage
            photo={photo}
            zoom={zoom}
            hideToolbar
            imageFilter={NEWSPRINT_FILTER}
          />
        </Box>
        <Box px="sm" pt={4} pb={2} style={{ flexShrink: 0 }}>
          {photo.metadata.comment ? (
            <Text c={INK_COLOR} fz={10} fs="italic" style={{ fontFamily: SERIF_FONT }}>
              {photo.metadata.comment}
            </Text>
          ) : (
            <Text
              c={INK_COLOR}
              fz={10}
              fs="italic"
              style={{ fontFamily: SERIF_FONT, opacity: 0.7 }}
            >
              Staff photo, above — see page A1 for the full story.
            </Text>
          )}
        </Box>

        {/* Column filler — implies the rest of a dense front page below the fold. */}
        <Box
          px="sm"
          pb="sm"
          pt={4}
          display="flex"
          style={{ gap: 10, borderTop: `1px solid ${INK_COLOR}`, flexShrink: 0 }}
        >
          <Box flex={1}>
            <ColumnFiller lines={3} />
          </Box>
          <Box flex={1} style={{ borderLeft: `1px solid ${INK_COLOR}`, paddingLeft: 10 }}>
            <ColumnFiller lines={3} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
