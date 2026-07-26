import {
  AspectRatio,
  Box,
  Center,
  Image,
  Kbd,
  Tooltip,
  UnstyledButton,
  useMantineTheme
} from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { useDraggable } from '@dnd-kit/core'
import { IconAlertTriangle, IconPhoto } from '@tabler/icons-react'
import type { ComponentPropsWithoutRef, MouseEvent, ReactElement } from 'react'
import type { PhotoRecord } from '../../../../shared/types'
import { toThumbProtocolUrl } from '../../../../shared/protocolUrls'
import { GalleryFileName } from './GalleryFileName'
import { GalleryHoverPreview } from './GalleryHoverPreview'
import { PREVIEW_TRIGGER_KEY_LABEL } from '../../utils/previewTrigger'
import { usePhotoLibrary } from '../../state/PhotoLibraryContext'
import { useHoverPreview } from '../../hooks/useHoverPreview'

interface PhotoThumbnailProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onSelect'> {
  photo: PhotoRecord
  selected: boolean
  // Distinct (lighter) highlight from `selected` for the rest of a
  // multi-selection.
  multiSelected: boolean
  onSelect: (path: string, event: MouseEvent) => void
  renaming: boolean
  onStartRename: () => void
  onStopRename: () => void
  onRename: (newBaseName: string) => Promise<void>
  // Whether the preview trigger key (utils/previewTrigger) is held anywhere
  // in the gallery.
  previewTriggerHeld: boolean
  // Preview zoom multiplier, lifted to GalleryGrid so it's shared across
  // whichever thumbnail is being previewed.
  previewScale: number
  // Renaming always shows the filename field regardless of this setting.
  showFilename: boolean
}

// Not a single root button — GalleryFileName's own edit button can't nest
// inside another button, so the image gets its own inner button while the
// filename stays a sibling. `...rest` carries PhotoContextMenu's injected
// handlers onto the outer container so right-click works anywhere on the cell.
export function PhotoThumbnail({
  photo,
  selected,
  multiSelected,
  onSelect,
  renaming,
  onStartRename,
  onStopRename,
  onRename,
  previewTriggerHeld,
  previewScale,
  showFilename,
  className,
  ...rest
}: PhotoThumbnailProps): ReactElement {
  const theme = useMantineTheme()
  const { openPhotoTab, state } = usePhotoLibrary()
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion
  const canPreview = previewTriggerHeld && photo.thumbnailStatus === 'ready'
  const { position, onMouseMove, onMouseLeave } = useHoverPreview(canPreview)

  // Drag carries the whole multi-selection if this photo is part of it,
  // otherwise just this one — same convention as the right-click menu.
  const dragPaths =
    state.selectedPaths.has(photo.filePath) && state.selectedPaths.size > 1
      ? Array.from(state.selectedPaths)
      : [photo.filePath]

  // Pointer-based (not native HTML5 drag), so the ghost that follows the
  // cursor is a real DOM element — see App.tsx's DragOverlay.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: photo.filePath,
    data: { paths: dragPaths }
  })

  return (
    <Tooltip
      label={
        <>Hold {<Kbd>{PREVIEW_TRIGGER_KEY_LABEL}</Kbd>} to preview, and scroll to zoom in or out</>
      }
      openDelay={5000}
      // Hidden once the preview itself is showing, so the hint doesn't overlap it.
      disabled={previewTriggerHeld || photo.thumbnailStatus !== 'ready'}
    >
      <Box
        {...rest}
        {...attributes}
        {...listeners}
        ref={setNodeRef}
        opacity={isDragging ? 0.4 : undefined}
        className={`photo-thumbnail${selected ? ' photo-thumbnail--selected' : ''}${!selected && multiSelected ? ' photo-thumbnail--multi-selected' : ''}${className ? ` ${className}` : ''}`}
      >
        <UnstyledButton
          className="photo-thumbnail__select-button"
          onClick={(event) => onSelect(photo.filePath, event)}
          onDoubleClick={() => openPhotoTab(photo.filePath)}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          w="100%"
          style={{ cursor: canPreview ? 'zoom-in' : undefined }}
        >
          {photo.thumbnailStatus === 'ready' && photo.thumbnailKey ? (
            <AspectRatio ratio={1} style={{ overflow: 'hidden' }}>
              <Image
                src={toThumbProtocolUrl(photo.thumbnailKey)}
                alt={photo.fileName}
                fit="cover"
                loading="lazy"
                w="100%"
                h="100%"
              />
            </AspectRatio>
          ) : (
            <Center
              className="photo-thumbnail__placeholder"
              c={photo.thumbnailStatus === 'error' ? 'red' : 'dimmed'}
            >
              {photo.thumbnailStatus === 'error' ? (
                <IconAlertTriangle size={theme.spacing.xl} />
              ) : (
                <IconPhoto size={theme.spacing.xl} />
              )}
            </Center>
          )}
        </UnstyledButton>
        <GalleryHoverPreview
          photo={photo}
          position={canPreview ? position : null}
          scale={previewScale}
          motionEnabled={motionEnabled}
        />
        {(showFilename || renaming) && (
          <Box w="100%">
            <GalleryFileName
              fileName={photo.fileName}
              editing={renaming}
              onStartEdit={onStartRename}
              onStopEdit={onStopRename}
              onRename={onRename}
            />
          </Box>
        )}
      </Box>
    </Tooltip>
  )
}
