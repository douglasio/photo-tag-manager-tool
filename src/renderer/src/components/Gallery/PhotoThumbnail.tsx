import { useDraggable } from '@dnd-kit/core'
import {
  AspectRatio,
  Box,
  Card,
  Center,
  Flex,
  Image,
  RollingNumber,
  UnstyledButton,
  useMantineTheme
} from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { IconAlertTriangle, IconEye, IconPhoto } from '@tabler/icons-react'
import type { ComponentPropsWithoutRef, MouseEvent, ReactElement } from 'react'

import { FileNameField } from '@components'
import { useHoverPreview } from '@hooks'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { useLibraryActions } from '@state'
import { ACTION_ICONS, isPhotoDisplayable, PREVIEW_TRIGGER_KEY } from '@utils'

import { GalleryHoverPreview } from './GalleryHoverPreview'

interface PhotoThumbnailProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onSelect'> {
  photo: PhotoRecord
  selected: boolean
  multiSelected: boolean
  // The full multi-selection set, for the drag payload below. Passed as a
  // prop (not read from context) so this component has no gallery-context
  // subscription — per-cell subscriptions defeat GalleryPhotoCell's memo.
  selectedPaths: Set<string>
  // Gallery animations setting, passed down for the same no-subscription reason.
  animationsEnabled: boolean
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
  // Shares the filename's row rather than adding its own.
  showViewCount: boolean
}

export function PhotoThumbnail({
  photo,
  selected,
  multiSelected,
  selectedPaths,
  animationsEnabled,
  onSelect,
  renaming,
  onStartRename,
  onStopRename,
  onRename,
  previewTriggerHeld,
  previewScale,
  showFilename,
  showViewCount,
  className,
  ...rest
}: PhotoThumbnailProps): ReactElement {
  const theme = useMantineTheme()
  const { openPhotoTab } = useLibraryActions()
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = animationsEnabled && !prefersReducedMotion
  const canPreview = previewTriggerHeld && photo.thumbnailStatus === 'ready'
  const { position, onMouseMove, onMouseLeave } = useHoverPreview(canPreview)

  // Drag carries the whole multi-selection if this photo is part of it,
  // otherwise just this one — same convention as the right-click menu.
  const dragPaths =
    selectedPaths.has(photo.filePath) && selectedPaths.size > 1
      ? Array.from(selectedPaths)
      : [photo.filePath]

  // Pointer-based (not native HTML5 drag), so the ghost that follows the
  // cursor is a real DOM element — see App.tsx's DragOverlay.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: photo.filePath,
    data: { paths: dragPaths }
  })

  const filenameVisible = showFilename || renaming
  const viewCountVisible = showViewCount && !renaming

  return (
    <Box
      {...rest}
      {...attributes}
      {...listeners}
      ref={setNodeRef}
      opacity={isDragging ? 0.4 : undefined}
      className={className ? `photo-thumbnail ${className}` : 'photo-thumbnail'}
    >
      <Card
        className="photo-thumbnail__card"
        padding="xs"
        data-selected={selected || undefined}
        data-multi-selected={(!selected && multiSelected) || undefined}
      >
        <Card.Section>
          <UnstyledButton
            className="photo-thumbnail__select-button"
            onClick={(event) => onSelect(photo.filePath, event)}
            onDoubleClick={() => openPhotoTab(photo.filePath)}
            // Space is the preview trigger (handled globally via useKeyHeld)
            onKeyDown={(event) => {
              if (event.key === PREVIEW_TRIGGER_KEY) event.preventDefault()
            }}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            w="100%"
            style={{ cursor: canPreview ? 'zoom-in' : undefined }}
          >
            {isPhotoDisplayable(photo) ? (
              <AspectRatio ratio={1} style={{ overflow: 'hidden' }}>
                <Image
                  src={toThumbProtocolUrl(photo.thumbnailKey)}
                  alt={photo.fileName}
                  fit="cover"
                  loading="lazy"
                  w="100%"
                  h="100%"
                  style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
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
        </Card.Section>
        <Card.Section inheritPadding pb="xs">
          {(filenameVisible || viewCountVisible) && (
            <Flex>
              {filenameVisible && (
                <FileNameField
                  fileName={photo.fileName}
                  editing={renaming}
                  onStartEdit={onStartRename}
                  onStopEdit={onStopRename}
                  onRename={onRename}
                  variant="grid"
                />
              )}
              {viewCountVisible && (
                <Flex c="dimmed" gap={2} mt={2}>
                  <IconEye size={ACTION_ICONS.ICON_SIZE} />
                  <RollingNumber value={photo.viewCount} fz="sm" mt="3" />
                </Flex>
              )}
            </Flex>
          )}
        </Card.Section>
      </Card>
      <GalleryHoverPreview
        photo={photo}
        position={canPreview ? position : null}
        scale={previewScale}
        motionEnabled={motionEnabled}
      />
    </Box>
  )
}
