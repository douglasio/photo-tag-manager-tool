import {
  AspectRatio,
  Box,
  Center,
  Image,
  Portal,
  Tooltip,
  UnstyledButton,
  useMantineTheme
} from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { useDraggable } from '@dnd-kit/core'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { IconAlertTriangle, IconPhoto } from '@tabler/icons-react'
import { useState, type ComponentPropsWithoutRef, type MouseEvent, type ReactElement } from 'react'
import type { PhotoRecord } from '../../../../shared/types'
import { toFileProtocolUrl, toThumbProtocolUrl } from '../../../../shared/protocolUrls'
import { GalleryFileName } from './GalleryFileName'
import { ctrlKeyLabel } from '../../utils/platform'
import { usePhotoLibrary } from '../../state/PhotoLibraryContext'

// Preview size at previewScale === 1, in viewport-relative units so it
// scales with the window rather than a fixed pixel size.
const BASE_PREVIEW_WIDTH_VW = 50
const BASE_PREVIEW_HEIGHT_VH = 70

// How far (px) the image can pan from center as the cursor moves across the
// thumbnail, and how much it's scaled up beforehand so panning never
// reveals empty space at the frame's edges.
const HOVER_PAN_RANGE_PX = 22
const HOVER_PAN_SCALE = 1.125
// A bit stiffer/less damped than a plain settle, to match the bigger
// range above with a snappier, more energetic response instead of a slow
// drift — still spring-eased rather than linear, just quicker to react.
const HOVER_PAN_SPRING = { stiffness: 400, damping: 22, mass: 0.5 }

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
  // The "Show filenames" gallery setting. Renaming always shows the field
  // regardless — otherwise there'd be nowhere to see what's being typed.
  showFilename: boolean
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
  showFilename,
  className,
  ...rest
}: PhotoThumbnailProps): ReactElement {
  const theme = useMantineTheme()
  const { openPhotoTab, state } = usePhotoLibrary()
  const canPreview = ctrlHeld && photo.thumbnailStatus === 'ready'
  // Tracks the cursor so the floating preview below can be centered directly
  // on it, rather than offset to the side like a regular tooltip.
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  // Off when the user has toggled it off in Settings, or when the OS-level
  // "reduce motion" preference is on — the setting doesn't override that,
  // it's an additional gate on top of it.
  const prefersReducedMotion = useReducedMotion()
  const panEnabled =
    state.galleryAnimationsEnabled && !prefersReducedMotion && photo.thumbnailStatus === 'ready'
  const panX = useMotionValue(0)
  const panY = useMotionValue(0)
  // Starts at 1 (not HOVER_PAN_SCALE) and only springs up on actual hover —
  // scaling constantly whenever animations are enabled, even at rest, would
  // permanently crop a bit of every thumbnail and blunt the before/after
  // contrast that makes the hover effect read as dramatic.
  const panScale = useMotionValue(1)
  const springX = useSpring(panX, HOVER_PAN_SPRING)
  const springY = useSpring(panY, HOVER_PAN_SPRING)
  const springScale = useSpring(panScale, HOVER_PAN_SPRING)

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
        opacity={isDragging ? 0.4 : undefined}
        className={`photo-thumbnail${selected ? ' photo-thumbnail--selected' : ''}${!selected && multiSelected ? ' photo-thumbnail--multi-selected' : ''}${className ? ` ${className}` : ''}`}
      >
        <UnstyledButton
          className="photo-thumbnail__select-button"
          onClick={(event) => onSelect(photo.filePath, event)}
          onDoubleClick={() => openPhotoTab(photo.filePath)}
          onMouseEnter={() => {
            if (panEnabled) panScale.set(HOVER_PAN_SCALE)
          }}
          onMouseMove={(event) => {
            if (canPreview) setCursorPos({ x: event.clientX, y: event.clientY })
            if (panEnabled) {
              const rect = event.currentTarget.getBoundingClientRect()
              const normalizedX = (event.clientX - rect.left) / rect.width - 0.5
              const normalizedY = (event.clientY - rect.top) / rect.height - 0.5
              panX.set(normalizedX * HOVER_PAN_RANGE_PX)
              panY.set(normalizedY * HOVER_PAN_RANGE_PX)
            }
          }}
          onMouseLeave={() => {
            setCursorPos(null)
            if (panEnabled) {
              panX.set(0)
              panY.set(0)
              panScale.set(1)
            }
          }}
          w="100%"
          style={{ cursor: canPreview ? 'zoom-in' : undefined }}
        >
          {photo.thumbnailStatus === 'ready' && photo.thumbnailKey ? (
            <AspectRatio ratio={1} style={{ overflow: 'hidden' }}>
              <motion.div
                style={{
                  width: '100%',
                  height: '100%',
                  x: springX,
                  y: springY,
                  scale: springScale
                }}
              >
                <Image
                  src={toThumbProtocolUrl(photo.thumbnailKey)}
                  alt={photo.fileName}
                  fit="cover"
                  loading="lazy"
                  // AspectRatio normally stretches its direct img child to
                  // 100% width/height itself (targeting a `> img` selector),
                  // but Image is now nested inside the motion.div wrapper
                  // instead, so it no longer gets that sizing for free —
                  // without it, non-square photos shrink to their natural
                  // aspect ratio instead of filling the square frame.
                  style={{ width: '100%', height: '100%' }}
                />
              </motion.div>
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
        {canPreview && cursorPos && (
          <Portal>
            <Box
              pos="fixed"
              bg="var(--mantine-color-body)"
              bdrs="md"
              left={cursorPos.x}
              top={cursorPos.y}
              style={{
                boxShadow: 'var(--mantine-shadow-elevated)',
                transform: 'translate(-50%, -50%)',
                // Preview must never intercept the pointer — it sits
                // directly under the cursor, so any pointer events here
                // would immediately hide it (mouse "leaving" the thumbnail).
                pointerEvents: 'none',
                zIndex: 'var(--mantine-z-index-max)'
              }}
            >
              <Image
                src={toFileProtocolUrl(photo.filePath, photo.thumbnailKey)}
                alt={photo.fileName}
                bdrs="md"
                fit="contain"
                maw={`min(${BASE_PREVIEW_WIDTH_VW * previewScale}vw, 92vw)`}
                mah={`min(${BASE_PREVIEW_HEIGHT_VH * previewScale}vh, 92vh)`}
                w="auto"
                h="auto"
              />
            </Box>
          </Portal>
        )}
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
