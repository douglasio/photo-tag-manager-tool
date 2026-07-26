import { ActionIcon, Box, Splitter } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import type { ReactElement } from 'react'
import type { PhotoRecord } from '../../../../shared/types'
import { usePannableZoom } from '../../hooks/usePannableZoom'
import { usePhotoLibrary } from '../../state/PhotoLibraryContext'
import { PannableZoomableImage } from '../Shared/PannableZoomableImage'

interface ComparePaneProps {
  photo: PhotoRecord
  showRemove: boolean
  onRemove: () => void
}

// One Splitter pane's worth of pannable/zoomable image, plus the
// remove-from-comparison button once there are more than 2 photos to choose
// from. A separate component (not inlined in CompareView's own render) so
// each pane gets its own usePannableZoom call — hooks can't be called a
// variable number of times within a single component.
function ComparePane({ photo, showRemove, onRemove }: ComparePaneProps): ReactElement {
  const zoom = usePannableZoom(photo)

  return (
    <Box pos="relative" h="100%" w="100%">
      <PannableZoomableImage photo={photo} zoom={zoom} />
      {showRemove && (
        <ActionIcon
          pos="absolute"
          top={8}
          right={8}
          variant="filled"
          color="dark"
          style={{ zIndex: 'var(--mantine-z-index-max)' }}
          aria-label={`Remove ${photo.fileName} from comparison`}
          onClick={onRemove}
        >
          <IconX size={14} />
        </ActionIcon>
      )}
    </Box>
  )
}

interface CompareViewProps {
  id: string
  photos: PhotoRecord[]
}

export function CompareView({ id, photos }: CompareViewProps): ReactElement {
  const { removeFromCompareTab } = usePhotoLibrary()
  // The close (X) button only makes sense once there's something to fall
  // back to beyond a plain 2-way compare — removing one of exactly 2 would
  // leave a single photo, which isn't a comparison anymore.
  const showRemove = photos.length > 2

  return (
    <Splitter orientation="horizontal" h="100%" w="100%">
      {photos.map((photo) => (
        <Splitter.Pane key={photo.filePath} defaultSize={`${100 / photos.length}%`} min="5%">
          <ComparePane
            photo={photo}
            showRemove={showRemove}
            onRemove={() => removeFromCompareTab(id, photo.filePath)}
          />
        </Splitter.Pane>
      ))}
    </Splitter>
  )
}
