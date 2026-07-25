import { ActionIcon, Box, Container, Flex, Group, Image, Slider, Tooltip } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { motion } from 'motion/react'
import {
  IconArrowsMaximize,
  IconMaximize,
  IconPhoto,
  IconRotate,
  IconRotateClockwise
} from '@tabler/icons-react'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ROTATABLE_FORMATS, type PhotoRecord } from '../../../../shared/types'
import { toFileProtocolUrl } from '../../../../shared/protocolUrls'
import { usePhotoLibrary } from '../../state/PhotoLibraryContext'
import { usePhotoEntranceExit } from '../../hooks/usePhotoEntranceExit'
import { usePhotoHoverEffects } from '../../hooks/usePhotoHoverEffects'

const MIN_SCALE = 1
const MAX_SCALE = 5
const SCALE_STEP = 0.25
// Matches the sensitivity used for the gallery's Ctrl+wheel preview zoom.
const WHEEL_ZOOM_SENSITIVITY = 0.025

interface PhotoViewProps {
  photo: PhotoRecord
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export function PhotoView({ photo }: PhotoViewProps): ReactElement {
  const { state, closePhotoTab, rotatePhoto, visiblePhotos, navigateToPhoto, consumeNavDirection } =
    usePhotoLibrary()
  const [scale, setScale] = useState(1)
  // Read once at mount via lazy initializer — this instance is fresh per photo.
  const [enterDirection] = useState(() => consumeNavDirection(photo.filePath))
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canRotate = ROTATABLE_FORMATS.includes(photo.metadata.format)
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion

  const { initial, animate, transition, handleImageLoad, triggerExit } = usePhotoEntranceExit({
    motionEnabled,
    enterDirection
  })
  const { saturationAmount, containerHandlers, zoomStyle, saturationOverlayStyle } =
    usePhotoHoverEffects(motionEnabled)

  const zoomToFit = (): void => setScale(MIN_SCALE)

  // Compensates for how much fit="contain" already shrank/grew the image,
  // so "original size" means true 1:1 pixels.
  const zoomToNativeSize = (): void => {
    const img = imgRef.current
    const container = containerRef.current
    if (!img || !container || !img.naturalWidth || !img.naturalHeight) return
    const fitScale = Math.min(
      container.clientWidth / img.naturalWidth,
      container.clientHeight / img.naturalHeight
    )
    if (!fitScale) return
    setScale(clampScale(1 / fitScale))
  }

  // Every opened photo's panel stays mounted, so gate keydown on whether
  // this tab is the one actually showing.
  const isActiveRef = useRef(false)
  useEffect(() => {
    isActiveRef.current = state.activeTab === photo.filePath
  }, [state.activeTab, photo.filePath])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Trackpad pinch is reported as ctrl+wheel; React's passive synthetic
    // onWheel can't preventDefault, so this needs a native listener.
    const handleWheel = (event: WheelEvent): void => {
      if (!isActiveRef.current || !event.ctrlKey) return
      event.preventDefault()
      setScale((prev) => clampScale(prev - event.deltaY * WHEEL_ZOOM_SENSITIVITY))
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isActiveRef.current) return
      if (event.key === 'Escape') {
        closePhotoTab(photo.filePath)
        return
      }
      // Alt+arrow switches tabs instead (handled globally in App.tsx).
      if (event.altKey) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Don't steal the keypress from the zoom slider's own arrow handling.
        if ((document.activeElement as HTMLElement | null)?.getAttribute('role') === 'slider') {
          return
        }
        const ordered = visiblePhotos.map((p) => p.filePath)
        const currentIndex = ordered.indexOf(photo.filePath)
        if (currentIndex === -1) return
        const direction = event.key === 'ArrowRight' ? 'right' : 'left'
        const nextIndex = direction === 'right' ? currentIndex + 1 : currentIndex - 1
        if (nextIndex < 0 || nextIndex >= ordered.length) return
        event.preventDefault()
        const toPath = ordered[nextIndex]
        if (!motionEnabled) {
          navigateToPhoto(photo.filePath, toPath, direction)
          return
        }
        // Play the exit animation first, navigate once it finishes.
        triggerExit(direction, () => navigateToPhoto(photo.filePath, toPath, direction))
        return
      }
      if (!event.ctrlKey) return
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setScale((prev) => clampScale(prev + SCALE_STEP))
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        setScale((prev) => clampScale(prev - SCALE_STEP))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closePhotoTab, photo.filePath, visiblePhotos, navigateToPhoto, motionEnabled, triggerExit])

  return (
    <Container fluid pos="relative" flex={1} mih={0} miw={0} h="100%">
      <Container
        ref={containerRef}
        fluid
        h="100%"
        display="flex"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        <motion.div
          // initial={false} renders straight at `animate` when disabled.
          initial={initial}
          animate={animate}
          transition={transition}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        >
          <Box pos="relative" maw="100%" mah="100%" {...containerHandlers}>
            <motion.div style={zoomStyle}>
              <Image
                ref={imgRef}
                src={toFileProtocolUrl(photo.filePath, photo.thumbnailKey)}
                alt={photo.fileName}
                fit="contain"
                onLoad={handleImageLoad}
                maw="100%"
                mah="100%"
                display="block"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'center'
                }}
              />
              {/* Saturated copy masked to a cursor-centered feathered circle;
                  suppressed while Ctrl-zoom is active. */}
              <motion.div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  ...saturationOverlayStyle
                }}
              >
                <Image
                  src={toFileProtocolUrl(photo.filePath, photo.thumbnailKey)}
                  alt=""
                  fit="contain"
                  maw="100%"
                  mah="100%"
                  display="block"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'center',
                    filter: `saturate(${saturationAmount})`
                  }}
                />
              </motion.div>
            </motion.div>
          </Box>
        </motion.div>
      </Container>
      <Flex pos="absolute" bottom={0} left={0} right={0} justify="space-between" p="md" gap="sm">
        {canRotate ? (
          <Group bg="gray" p="sm" gap="sm" wrap="nowrap">
            <ActionIcon
              onClick={() => void rotatePhoto(photo.filePath, 'left')}
              aria-label="Rotate left"
            >
              <Tooltip label="Rotate left">
                <IconRotate size={18} />
              </Tooltip>
            </ActionIcon>
            <ActionIcon
              onClick={() => void rotatePhoto(photo.filePath, 'right')}
              aria-label="Rotate right"
            >
              <Tooltip label="Rotate right">
                <IconRotateClockwise size={18} />
              </Tooltip>
            </ActionIcon>
          </Group>
        ) : (
          <div />
        )}
        <Group bg="gray" p="sm" gap="sm" wrap="nowrap">
          {/* Slider stays a plain sibling, not inside ActionIcon.Group — that
              component expects a static label/icon, not a rich control. */}
          <ActionIcon onClick={zoomToFit} aria-label="Zoom to fit">
            <Tooltip label="Zoom to fit">
              <IconMaximize />
            </Tooltip>
          </ActionIcon>
          <ActionIcon onClick={zoomToNativeSize} aria-label="Original size">
            <Tooltip label="Original size">
              <IconArrowsMaximize />
            </Tooltip>
          </ActionIcon>
          <ActionIcon
            onClick={() => setScale((prev) => clampScale(prev - SCALE_STEP))}
            aria-label="Zoom out"
          >
            <Tooltip label="Zoom out">
              <IconPhoto size={12} />
            </Tooltip>
          </ActionIcon>
          <Slider
            value={scale}
            onChange={setScale}
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.1}
            label={null}
            w={120}
          />
          <ActionIcon
            onClick={() => setScale((prev) => clampScale(prev + SCALE_STEP))}
            aria-label="Zoom in"
          >
            <Tooltip label="Zoom in">
              <IconPhoto size={22} />
            </Tooltip>
          </ActionIcon>
        </Group>
      </Flex>
    </Container>
  )
}
