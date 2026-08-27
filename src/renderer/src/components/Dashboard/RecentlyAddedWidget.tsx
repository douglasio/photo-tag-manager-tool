import { type ReactElement, useMemo } from 'react'

import { Image, SimpleGrid, Text, UnstyledButton } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'

import { GalleryHoverPreview, PhotoGradientOverlay } from '@components'
import { useHoverPreview } from '@hooks'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { useGalleryLibrary, useLibraryActions, usePreviewTriggerHeld } from '@state'
import { isPhotoDisplayable, PREVIEW_TRIGGER_KEY } from '@utils'

import { useDashboardPreviewScale } from './DashboardPreviewZoomContext'

// A small contained 2x2 grid, not one row spanning the widget's full width.
const RECENT_COUNT = 4
const GRID_COLS = 2

interface RecentTileProps {
  photo: PhotoRecord
  previewTriggerHeld: boolean
  motionEnabled: boolean
  onOpen: () => void
}

// Own hover-preview session per tile (mirrors FeaturedTagWidget's collage) —
// a row of independent buttons has no single "currently hovered photo" to
// hang one shared preview off of.
function RecentTile({
  photo,
  previewTriggerHeld,
  motionEnabled,
  onOpen
}: RecentTileProps): ReactElement {
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
        className="dashboard-photo-frame"
        pos="relative"
        h="100%"
        w="100%"
        style={{ cursor: canPreview ? 'zoom-in' : undefined, overflow: 'hidden', minHeight: 0 }}
      >
        <Image
          src={toThumbProtocolUrl(photo.thumbnailKey!)}
          alt={photo.fileName}
          fit="cover"
          h="100%"
          w="100%"
        />
        <PhotoGradientOverlay />
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

// The RECENT_COUNT most recently added photos (by firstSeenAt), newest first.
export function RecentlyAddedWidget(): ReactElement {
  const { state, activePhotosByPath } = useGalleryLibrary()
  const { openPhotoTab } = useLibraryActions()
  const previewTriggerHeld = usePreviewTriggerHeld()
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion

  const recentPhotos = useMemo(
    () =>
      Array.from(activePhotosByPath.values())
        .filter((photo) => isPhotoDisplayable(photo) && photo.firstSeenAt)
        .sort((a, b) => (b.firstSeenAt ?? 0) - (a.firstSeenAt ?? 0))
        .slice(0, RECENT_COUNT),
    [activePhotosByPath]
  )

  if (recentPhotos.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Add some photos to see the most recent ones here.
      </Text>
    )
  }

  return (
    <SimpleGrid
      cols={GRID_COLS}
      spacing="xs"
      autoRows="1fr"
      h="100%"
      style={{ flex: 1, minHeight: 0 }}
    >
      {recentPhotos.map((photo) => (
        <RecentTile
          key={photo.id}
          photo={photo}
          previewTriggerHeld={previewTriggerHeld}
          motionEnabled={motionEnabled}
          onOpen={() => openPhotoTab(photo.filePath)}
        />
      ))}
    </SimpleGrid>
  )
}
