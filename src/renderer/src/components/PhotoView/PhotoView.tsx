import { ActionIcon, Box, Container, Flex, Group, Image, Slider, Tooltip } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'motion/react'
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
import { useCtrlKeyHeld } from '../../hooks/useCtrlKeyHeld'

const MIN_SCALE = 1
const MAX_SCALE = 5
const SCALE_STEP = 0.25
// Matches the sensitivity used for the gallery's Ctrl+wheel preview zoom.
const WHEEL_ZOOM_SENSITIVITY = 0.025
// Entrance: scale/blur only, coming into focus along the z-axis.
const ENTRANCE_SCALE_FROM = 1.08
const ENTRANCE_BLUR_FROM_PX = 5
const ENTRANCE_SPRING = { stiffness: 300, damping: 24, mass: 0.6 } as const
// x-axis slide for arrow-key navigation only (enterDirection is null for a
// plain tab open, so no offset applies there).
const ENTRANCE_X_FROM_PX = 100
// Arrow-key nav remounts a fresh PhotoView, so there's no DOM node to
// cross-fade against — this plays a brief exit animation on the current
// photo first, then navigates once it finishes.
const EXIT_DURATION_S = 0.16
const EXIT_SCALE_TO = 0.94
const EXIT_BLUR_TO_PX = 8
const EXIT_TRANSITION = { duration: EXIT_DURATION_S, ease: 'easeIn' } as const
// Opening a photo tab also collapses the Navbar/Aside via AppShell's own
// 200ms transition — wait for that before starting the entrance animation.
const APP_SHELL_SETTLE_MS = 200
// Hover saturates a soft, cursor-centered, feathered circle (a saturated
// image copy masked by a radial gradient) rather than zooming.
const SATURATION_RADIUS_PX = 270
const SATURATION_AMOUNT = 1.5
const SATURATION_SPRING = { stiffness: 300, damping: 30, mass: 0.5 } as const
// Ctrl+hover swaps the saturation effect for a pronounced cursor-zoom.
const CTRL_ZOOM_SCALE = 4
const CTRL_ZOOM_SPRING = { stiffness: 300, damping: 30, mass: 0.5 } as const

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
  // Set while the exit animation is playing, just before this instance is
  // swapped out for the next photo's.
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null)
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current)
    },
    []
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canRotate = ROTATABLE_FORMATS.includes(photo.metadata.format)
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion
  // Gates the entrance until the image has actually loaded, so it doesn't
  // play while the container is still resizing around a loading image.
  const [imageLoaded, setImageLoaded] = useState(false)
  // Separately gates on the AppShell collapse (APP_SHELL_SETTLE_MS) finishing.
  const [layoutSettled, setLayoutSettled] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setLayoutSettled(true), APP_SHELL_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [])
  const readyToAnimateIn = imageLoaded && layoutSettled

  // Plain motion values so the saturation mask can follow the cursor
  // without a React re-render on every pointer move.
  const maskX = useMotionValue(0)
  const maskY = useMotionValue(0)
  const maskOpacity = useMotionValue(0)
  const springMaskOpacity = useSpring(maskOpacity, SATURATION_SPRING)
  const maskImage = useMotionTemplate`radial-gradient(circle ${SATURATION_RADIUS_PX}px at ${maskX}px ${maskY}px, black 0%, black 35%, transparent 100%)`

  // Tracked via state (not just a motion value) so the effect below can
  // react to ctrlHeld changing while the pointer isn't moving.
  const ctrlHeld = useCtrlKeyHeld()
  const [isHovering, setIsHovering] = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState('center center')
  const zoomScale = useMotionValue(1)
  const springZoomScale = useSpring(zoomScale, CTRL_ZOOM_SPRING)

  useEffect(() => {
    if (!motionEnabled) return
    if (isHovering && ctrlHeld) {
      zoomScale.set(CTRL_ZOOM_SCALE)
      maskOpacity.set(0)
    } else {
      zoomScale.set(1)
    }
  }, [ctrlHeld, isHovering, motionEnabled, zoomScale, maskOpacity])

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
        // Already mid-exit from a previous press — ignore repeats.
        if (exitDirection) return
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
        setExitDirection(direction)
        exitTimeoutRef.current = setTimeout(() => {
          navigateToPhoto(photo.filePath, toPath, direction)
        }, EXIT_DURATION_S * 1000)
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
  }, [closePhotoTab, photo.filePath, visiblePhotos, navigateToPhoto, exitDirection, motionEnabled])

  return (
    <Container
      fluid
      style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0, height: '100%' }}
    >
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
          initial={
            motionEnabled
              ? {
                  scale: ENTRANCE_SCALE_FROM,
                  x:
                    enterDirection === 'right'
                      ? ENTRANCE_X_FROM_PX
                      : enterDirection === 'left'
                        ? -ENTRANCE_X_FROM_PX
                        : 0,
                  filter: `blur(${ENTRANCE_BLUR_FROM_PX}px)`
                }
              : false
          }
          // Holds at `initial` until the image/layout are ready, then
          // settles in — or, if exiting, overrides with the exit target.
          animate={
            exitDirection
              ? {
                  scale: EXIT_SCALE_TO,
                  x: exitDirection === 'right' ? -ENTRANCE_X_FROM_PX : ENTRANCE_X_FROM_PX,
                  filter: `blur(${EXIT_BLUR_TO_PX}px)`,
                  opacity: 0
                }
              : !motionEnabled || readyToAnimateIn
                ? { scale: 1, x: 0, filter: 'blur(0px)', opacity: 1 }
                : {
                    scale: ENTRANCE_SCALE_FROM,
                    x:
                      enterDirection === 'right'
                        ? ENTRANCE_X_FROM_PX
                        : enterDirection === 'left'
                          ? -ENTRANCE_X_FROM_PX
                          : 0,
                    filter: `blur(${ENTRANCE_BLUR_FROM_PX}px)`,
                    opacity: 1
                  }
          }
          transition={exitDirection ? EXIT_TRANSITION : ENTRANCE_SPRING}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        >
          <Box
            pos="relative"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            onMouseMove={(event) => {
              if (!motionEnabled) return
              const rect = event.currentTarget.getBoundingClientRect()
              const xPct = ((event.clientX - rect.left) / rect.width) * 100
              const yPct = ((event.clientY - rect.top) / rect.height) * 100
              setZoomOrigin(`${xPct}% ${yPct}%`)
              if (ctrlHeld) {
                maskOpacity.set(0)
              } else {
                maskX.set(event.clientX - rect.left)
                maskY.set(event.clientY - rect.top)
                maskOpacity.set(1)
              }
            }}
            onMouseEnter={() => {
              if (!motionEnabled) return
              setIsHovering(true)
              if (!ctrlHeld) maskOpacity.set(1)
            }}
            onMouseLeave={() => {
              setIsHovering(false)
              maskOpacity.set(0)
            }}
          >
            <motion.div style={{ scale: springZoomScale, transformOrigin: zoomOrigin }}>
              <Image
                ref={imgRef}
                src={toFileProtocolUrl(photo.filePath, photo.thumbnailKey)}
                alt={photo.fileName}
                fit="contain"
                onLoad={() => setImageLoaded(true)}
                maw="100%"
                mah="100%"
                style={{
                  display: 'block',
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
                  opacity: springMaskOpacity,
                  maskImage,
                  WebkitMaskImage: maskImage
                }}
              >
                <Image
                  src={toFileProtocolUrl(photo.filePath, photo.thumbnailKey)}
                  alt=""
                  display="block"
                  fit="contain"
                  maw="100%"
                  mah="100%"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'center',
                    filter: `saturate(${SATURATION_AMOUNT})`
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
