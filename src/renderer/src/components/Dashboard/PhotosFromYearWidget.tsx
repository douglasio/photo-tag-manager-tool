import { type ReactElement, useEffect, useRef, useState } from 'react'

import {
  AspectRatio,
  Group,
  Image,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton
} from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'

import { GalleryHoverPreview } from '@components'
import { useHoverPreview } from '@hooks'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord, ThrowbackYearSample } from '@shared/types'
import { usePhotoLibrary, usePreviewTriggerHeld } from '@state'
import { PREVIEW_TRIGGER_KEY } from '@utils'

import { useDashboardPreviewScale } from './DashboardPreviewZoomContext'

// A 2x2 grid whose tiles stretch to fill the widget's full height (not
// aspect-ratio-square, since this section can grow tall alongside Time
// Warp's timeline) — matches RecentlyAddedWidget's tile-fill approach.
const GRID_COLS = 2

interface YearTileProps {
  photo: PhotoRecord
  previewTriggerHeld: boolean
  motionEnabled: boolean
  onOpen: () => void
}

// Own hover-preview session per tile (mirrors RecentlyAddedWidget) — black
// and white by default via the photos-from-year-tile class, fading to color
// on hover.
function YearTile({
  photo,
  previewTriggerHeld,
  motionEnabled,
  onOpen
}: YearTileProps): ReactElement {
  const canPreview = previewTriggerHeld && photo.thumbnailStatus === 'ready'
  const { position, onMouseMove, onMouseLeave } = useHoverPreview(canPreview)
  const previewScale = useDashboardPreviewScale()

  return (
    <>
      <UnstyledButton
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === PREVIEW_TRIGGER_KEY) event.preventDefault()
        }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="dashboard-photo-frame photos-from-year-tile"
        pos="relative"
        h="100%"
        w="100%"
        style={{ cursor: canPreview ? 'zoom-in' : undefined, overflow: 'hidden', minHeight: 0 }}
      >
        <AspectRatio ratio={1}>
          <Image
            src={toThumbProtocolUrl(photo.thumbnailKey!)}
            alt={photo.fileName}
            fit="cover"
            h="100%"
            w="100%"
          />
        </AspectRatio>
      </UnstyledButton>
      <GalleryHoverPreview
        photo={photo}
        position={canPreview ? position : null}
        scale={previewScale}
        motionEnabled={motionEnabled}
      />
    </>
  )
}

// The AI-independent half of the old ThrowbackWidget: a random sample from a
// single past year, no embeddings involved — always available regardless of
// whether AI features (and Time Warp's cross-year similarity) are enabled.
export function PhotosFromYearWidget(): ReactElement {
  const { state, activePhotosByPath, getThrowbackYearSample, openPhotoTab } = usePhotoLibrary()
  const previewTriggerHeld = usePreviewTriggerHeld()
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion
  const [loading, setLoading] = useState(true)
  const [yearSample, setYearSample] = useState<ThrowbackYearSample | null>(null)
  const hasLoadedOnceRef = useRef(false)
  const lastFetchedExcludedFoldersRef = useRef(state.excludedFolders)

  useEffect(() => {
    const excludedFoldersChanged = state.excludedFolders !== lastFetchedExcludedFoldersRef.current
    // A Dashboard tab revisit re-runs this effect without anything actually
    // changing — skip once already loaded, per the "once per session" ask,
    // unless a folder's excluded-from-features status just flipped: the
    // sample needs a genuine recalculation then, not just activePhotosByPath
    // hiding an excluded tile from an otherwise-stale sample.
    if (hasLoadedOnceRef.current && !excludedFoldersChanged) return
    lastFetchedExcludedFoldersRef.current = state.excludedFolders
    let cancelled = false
    if (!hasLoadedOnceRef.current) setLoading(true)
    getThrowbackYearSample()
      .then((result) => {
        if (!cancelled) setYearSample(result)
      })
      .catch((err: unknown) => console.error('failed to load a photos-from-year sample', err))
      .finally(() => {
        if (cancelled) return
        hasLoadedOnceRef.current = true
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [getThrowbackYearSample, state.excludedFolders])

  if (loading) {
    return (
      <Group>
        <Loader size="sm" />
        <Text>Loading...</Text>
      </Group>
    )
  }

  if (!yearSample) {
    return (
      <Text c="dimmed" size="sm">
        Add photos spanning more than one year to see photos from the past.
      </Text>
    )
  }

  return (
    <Stack gap="sm" h="100%">
      <Title order={3} c="dimmed" style={{ flexShrink: 0 }}>
        Photos from {yearSample.year}
      </Title>
      <SimpleGrid
        cols={GRID_COLS}
        spacing="xs"
        autoRows="1fr"
        mih={0}
        // style={{ flex: 1, minHeight: 0 }}
      >
        {yearSample.filePaths.map((filePath) => {
          const photo = activePhotosByPath.get(filePath)
          if (!photo?.thumbnailKey) return null
          return (
            <YearTile
              key={filePath}
              photo={photo}
              previewTriggerHeld={previewTriggerHeld}
              motionEnabled={motionEnabled}
              onOpen={() => openPhotoTab(photo.filePath)}
            />
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}
