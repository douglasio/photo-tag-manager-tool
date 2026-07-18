import { Box, Center, Image, Tooltip, UnstyledButton, useMantineTheme } from '@mantine/core'
import { useDraggable } from '@dnd-kit/core'
import { IconAlertTriangle, IconPhoto } from '@tabler/icons-react'
import type { ComponentPropsWithoutRef, MouseEvent, ReactElement } from 'react'
import type { PhotoRecord } from '../../../shared/types'
import { toFileProtocolUrl, toThumbProtocolUrl } from '../../../shared/protocolUrls'
import { GalleryFileName } from './GalleryFileName'
import { ctrlKeyLabel } from '../utils/platform'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'

// Preview size at previewScale === 1, in viewport-relative units so it
// scales with the window rather than a fixed pixel size.
const BASE_PREVIEW_WIDTH_VW = 50
const BASE_PREVIEW_HEIGHT_VH = 70

interface PhotoThumbnailProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onSelect'> {
  photo: PhotoRecord
  selected: boolean
  // Part of the active multi-selection, but not the DetailPanel-primary
  // photo — gets a distinct (lighter) highlight from `selected`.
  multiSelected: boolean
  onSelect: (path: string, event: MouseEvent) => void
  renaming: boolean
  onStartRename: () => void
  onStopRename: () => void
  onRename: (newBaseName: string) => Promise<void>
  // Whether Ctrl is currently held anywhere in the gallery — gates the
  // larger floating preview so it only shows during an intentional
  // Ctrl+hover, not on every ordinary hover.
  ctrlHeld: boolean
  // Multiplier applied to the base preview size, adjusted via Ctrl+wheel
  // while hovering (lifted up to GalleryGrid, not local state, so it's
  // shared across whichever thumbnail is currently being previewed).
  previewScale: number
}

// The root can't be a single button anymore — GalleryFileName's inline editor
// (via InlineEditField) renders its own nested pencil ActionIcon button, and a
// button can't be nested inside another button. So the image gets its own
// inner button for click-to-select, while the filename is a sibling. `...rest`
// (needed for PhotoContextMenu's onContextMenu/onMouseDown injection) moves to
// this outer, non-button container since right-click should work anywhere on
// the thumbnail.
export function PhotoThumbnail({
  photo,
  selected,
  multiSelected,
  onSelect,
  renaming,
  onStartRename,
  onStopRename,
  onRename,
  ctrlHeld,
  previewScale,
  className,
  ...rest
}: PhotoThumbnailProps): ReactElement {
  const theme = useMantineTheme()
  const { openPhotoTab, state } = usePhotoLibrary()
  const canPreview = ctrlHeld && photo.thumbnailStatus === 'ready'

  // Dragging a photo that's part of the active multi-selection (2+ photos)
  // carries the whole batch; dragging anything else carries just that one —
  // same "what's actually selected" convention as the right-click menu.
  const dragPaths =
    state.selectedPaths.has(photo.filePath) && state.selectedPaths.size > 1
      ? Array.from(state.selectedPaths)
      : [photo.filePath]

  // dnd-kit tracks the drag via pointer events rather than the native HTML5
  // drag API, so the ghost that follows the cursor is a real DOM element
  // (see App.tsx's DragOverlay) instead of a browser/OS drag-image
  // snapshot — no more canvas/setDragImage workarounds needed.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: photo.filePath,
    data: { paths: dragPaths }
  })

  return (
    <Tooltip
      label={`Hold ${ctrlKeyLabel} to preview, hold ${ctrlKeyLabel} and scroll to zoom in or out`}
      openDelay={2000}
      // Hidden once Ctrl is actually held, since the larger floating image
      // preview takes over at that point and this hint would just overlap it.
      disabled={ctrlHeld || photo.thumbnailStatus !== 'ready'}
    >
      <Box
        {...rest}
        {...attributes}
        {...listeners}
        ref={setNodeRef}
        title={photo.fileName}
        style={{ ...rest.style, opacity: isDragging ? 0.4 : undefined }}
        className={`photo-thumbnail${selected ? ' photo-thumbnail--selected' : ''}${!selected && multiSelected ? ' photo-thumbnail--multi-selected' : ''}${className ? ` ${className}` : ''}`}
      >
        <Tooltip.Floating
          disabled={!canPreview}
          offset={16}
          label={
            <Image
              src={toFileProtocolUrl(photo.filePath)}
              alt={photo.fileName}
              fit="contain"
              style={{
                // Capped against the viewport regardless of zoom — otherwise
                // at high previewScale the image is larger than the window
                // itself and floating-ui's shift can't reposition it fully
                // on-screen, so it visibly spills past the window edges.
                maxWidth: `min(${BASE_PREVIEW_WIDTH_VW * previewScale}vw, 92vw)`,
                maxHeight: `min(${BASE_PREVIEW_HEIGHT_VH * previewScale}vh, 92vh)`,
                width: 'auto',
                height: 'auto'
              }}
            />
          }
          styles={{
            tooltip: {
              padding: 4,
              backgroundColor: 'var(--mantine-color-body)',
              border: '1px solid var(--mantine-color-default-border)'
            }
          }}
        >
          <UnstyledButton
            className="photo-thumbnail__select-button"
            onClick={(event) => onSelect(photo.filePath, event)}
            onDoubleClick={() => openPhotoTab(photo.filePath)}
            w="100%"
          >
            {photo.thumbnailStatus === 'ready' && photo.thumbnailKey ? (
              <Image
                src={toThumbProtocolUrl(photo.thumbnailKey)}
                alt={photo.fileName}
                fit="cover"
                loading="lazy"
                style={{ aspectRatio: 1, width: '100%' }}
              />
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
        </Tooltip.Floating>
        <Box w="100%">
          <GalleryFileName
            fileName={photo.fileName}
            editing={renaming}
            onStartEdit={onStartRename}
            onStopEdit={onStopRename}
            onRename={onRename}
          />
        </Box>
      </Box>
    </Tooltip>
  )
}
