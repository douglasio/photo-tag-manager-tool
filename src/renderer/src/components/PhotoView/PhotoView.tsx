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
// A typical wheel "notch" reports a deltaY of roughly 100, matching the
// sensitivity used for the gallery's Ctrl+wheel preview zoom.
const WHEEL_ZOOM_SENSITIVITY = 0.025
// Entrance: photo starts slightly scaled up and blurred, then springs down
// to its resting scale while sharpening — scale/blur only, no x/y movement,
// so it reads as the image coming into focus along the z-axis rather than
// sliding or falling in from a direction.
const ENTRANCE_SCALE_FROM = 1.08
const ENTRANCE_BLUR_FROM_PX = 12
const ENTRANCE_SPRING = { stiffness: 300, damping: 24, mass: 0.6 } as const
// Opening a photo tab also collapses the Navbar (and possibly the Aside) via
// AppShell's own default 200ms width transition, resizing the space this
// photo is centered in. Starting the entrance animation immediately meant
// it played while that resize was still happening, which read as the photo
// "fighting" its own frame — so it waits this long before starting.
const APP_SHELL_SETTLE_MS = 200
// Hovering over the photo saturates a soft, feathered circle under the
// cursor  — achieved by stacking a second, more
// saturated copy of the image on top and masking it down to a radial
// gradient that follows the pointer. The gradient's own mid-stop is the
// feather: solid color out to that point, fading to fully transparent by
// the outer radius, so there's no visible hard edge.
const SATURATION_RADIUS_PX = 270
const SATURATION_AMOUNT = 1.5
const SATURATION_SPRING = { stiffness: 300, damping: 30, mass: 0.5 } as const
// Holding Ctrl while hovering swaps the saturation effect for a much more
// pronounced zoom toward the cursor — releasing Ctrl (or leaving the image)
// drops back to 1x, and the saturation mask stays suppressed the whole time
// so the two effects never fight each other.
const CTRL_ZOOM_SCALE = 4
const CTRL_ZOOM_SPRING = { stiffness: 300, damping: 30, mass: 0.5 } as const

interface PhotoViewProps {
  photo: PhotoRecord
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export function PhotoView({ photo }: PhotoViewProps): ReactElement {
  const { state, closePhotoTab, rotatePhoto, visiblePhotos, navigateToPhoto } = usePhotoLibrary()
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canRotate = ROTATABLE_FORMATS.includes(photo.metadata.format)
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion
  // Gates the entrance animation so it only starts once the full-size image
  // has actually loaded and the container has settled at its final size —
  // starting it immediately on mount meant the fall/blur-in played while the
  // frame itself was still resizing around the loading image, undercutting
  // the effect.
  const [imageLoaded, setImageLoaded] = useState(false)
  // Separately gates on the AppShell Navbar/Aside collapse (see
  // APP_SHELL_SETTLE_MS above) finishing, regardless of how fast the image
  // itself loads.
  const [layoutSettled, setLayoutSettled] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setLayoutSettled(true), APP_SHELL_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [])
  const readyToAnimateIn = imageLoaded && layoutSettled

  // Cursor position (in px, relative to the image wrapper) driving the
  // saturation mask below — plain motion values so the mask can be
  // repositioned on every pointer move without a React re-render.
  const maskX = useMotionValue(0)
  const maskY = useMotionValue(0)
  const maskOpacity = useMotionValue(0)
  const springMaskOpacity = useSpring(maskOpacity, SATURATION_SPRING)
  const maskImage = useMotionTemplate`radial-gradient(circle ${SATURATION_RADIUS_PX}px at ${maskX}px ${maskY}px, black 0%, black 35%, transparent 100%)`

  // Ctrl-hover zoom: same cursor-relative transform-origin idea as the
  // saturation mask, but driving a scale instead. Tracked via plain state
  // (not just motion values) because the effect below needs to react to
  // ctrlHeld changing while the pointer isn't moving — e.g. pressing Ctrl
  // after already hovering, with no new mousemove to trigger it from.
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

  // "Original scale" means true 1:1 pixels — natural image size, not just
  // the current fit-to-container size — so this measures how much the
  // fit="contain" rendering already shrank/grew the image and compensates.
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

  // Mantine's Tabs keeps every opened photo's panel mounted (not just the
  // active one), so a global keydown listener registered by an inactive tab
  // would otherwise still fire — gate on whether this tab is the one showing.
  const isActiveRef = useRef(false)
  useEffect(() => {
    isActiveRef.current = state.activeTab === photo.filePath
  }, [state.activeTab, photo.filePath])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Trackpad pinch gestures are reported by Chromium as wheel events with
    // ctrlKey set to true — there's no separate gesture API in Electron —
    // so this same listener covers both a real pinch and a deliberate
    // Ctrl+scroll. React's synthetic onWheel is passive by default, which
    // silently blocks preventDefault, so this needs a native listener.
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
      // Alt+arrow switches between open tabs instead (handled globally in
      // App.tsx, works from any tab) — bail out so this handler doesn't
      // also act on the same keypress.
      if (event.altKey) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // The zoom slider below has its own native arrow-key handling
        // (adjust its value) — don't steal that keypress out from under it
        // when it's the focused element.
        if ((document.activeElement as HTMLElement | null)?.getAttribute('role') === 'slider') {
          return
        }
        const ordered = visiblePhotos.map((p) => p.filePath)
        const currentIndex = ordered.indexOf(photo.filePath)
        if (currentIndex === -1) return
        const nextIndex = event.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1
        if (nextIndex < 0 || nextIndex >= ordered.length) return
        event.preventDefault()
        navigateToPhoto(photo.filePath, ordered[nextIndex])
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
  }, [closePhotoTab, photo.filePath, visiblePhotos, navigateToPhoto])

  return (
    <Container
      fluid
      style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0, height: '100%' }}
    >
      <Container
        ref={containerRef}
        fluid
        h="100%"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        <motion.div
          // initial={false} skips the animation entirely (renders straight
          // at the `animate` values) when disabled, rather than just
          // shortening the transition to ~0 — matches the gallery hover
          // effect's own galleryAnimationsEnabled + reduced-motion gating.
          initial={
            motionEnabled
              ? {
                  scale: ENTRANCE_SCALE_FROM,
                  filter: `blur(${ENTRANCE_BLUR_FROM_PX}px)`
                }
              : false
          }
          // Until the image has loaded, this holds at the same values as
          // `initial` (a no-op "animation") instead of settling early —
          // the actual scale/unblur only fires once imageLoaded flips true.
          animate={
            !motionEnabled || readyToAnimateIn
              ? { scale: 1, filter: 'blur(0px)' }
              : {
                  scale: ENTRANCE_SCALE_FROM,
                  filter: `blur(${ENTRANCE_BLUR_FROM_PX}px)`
                }
          }
          transition={ENTRANCE_SPRING}
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
              {/* Saturated copy of the same image, masked down to a soft
                  circle that follows the cursor — the feathered mid-stop in
                  maskImage above is what keeps its edge from ever looking
                  hard-cut. Suppressed (opacity forced to 0) while the
                  Ctrl-zoom above is active, so the two effects never overlap. */}
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
                  fit="contain"
                  maw="100%"
                  mah="100%"
                  style={{
                    display: 'block',
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
          {/* ActionIcon.Group's seamless merged-pill look depends on every
              sibling sharing one height, and ActionIcon.GroupSection is meant
              for a static label/icon (like Button.GroupSection), not a rich
              control like a Slider — so the Slider stays a plain sibling
              here rather than living inside the group. */}
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
