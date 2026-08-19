import { Image, UnstyledButton } from '@mantine/core'
import type { ReactElement } from 'react'

import { GalleryHoverPreview, PhotoGradientOverlay } from '@components'
import { useHoverPreview } from '@hooks'
import { RADIUS_SIZE } from '@renderer/theme'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { PREVIEW_TRIGGER_KEY } from '@utils'

import { useDashboardPreviewScale } from './DashboardPreviewZoomContext'

interface PhotoCollageTileProps {
  photo: PhotoRecord
  previewTriggerHeld: boolean
  motionEnabled: boolean
  onOpen: () => void
}

// Each tile gets its own hover-preview session (mirrors gallery thumbnails)
// rather than sharing one at the widget level, since a Carousel of
// independent slides has no shared "currently hovered photo" state to hang
// a single preview off of. Shared by FeaturedTagWidget and FeaturedPersonWidget.
export function PhotoCollageTile({
  photo,
  previewTriggerHeld,
  motionEnabled,
  onOpen
}: PhotoCollageTileProps): ReactElement {
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
        h="100%"
        w="100%"
        display="block"
        style={{ minHeight: 0, cursor: canPreview ? 'zoom-in' : undefined }}
      >
        <Image
          src={toThumbProtocolUrl(photo.thumbnailKey!)}
          alt={photo.fileName}
          fit="cover"
          h="100%"
          w="100%"
          bdrs={RADIUS_SIZE}
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
