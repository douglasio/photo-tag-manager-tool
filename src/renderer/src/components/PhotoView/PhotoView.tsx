import { ActionIcon, Container, Flex, Group, Image, Slider, Tooltip } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { motion, useMotionValue, useSpring } from 'motion/react'
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
// Same animation language as the gallery's Ken Burns hover effect
// (PhotoThumbnail.tsx): a spring-eased scale, no opacity fade or position
// slide. Starts zoomed in and settles down to 1, like the image is
// adjusting into place rather than fading/sliding in.
const ENTRANCE_SCALE_FROM = 1.15
const ENTRANCE_SPRING = { stiffness: 400, damping: 22, mass: 0.5 } as const
// Subtle zoom-toward-cursor on hover, same spring as the entrance/gallery
// effects — independent of the manual zoom slider (a separate transform on
// the Image itself), so the two don't fight each other.
const HOVER_ZOOM_SCALE = 1.08
// Holding Ctrl while hovering swaps the subtle hover-zoom for a much more
// pronounced one, still anchored to the cursor — releasing Ctrl drops back
// to the plain hover-zoom (or to 1 if the cursor's since left).
const CTRL_ZOOM_SCALE = 4

interface PhotoViewProps {
  photo: PhotoRecord
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export function PhotoView({ photo }: PhotoViewProps): ReactElement {
  const { state, closePhotoTab, rotatePhoto } = usePhotoLibrary()
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canRotate = ROTATABLE_FORMATS.includes(photo.metadata.format)
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion

  // Where the hover-zoom scales from, as a CSS `transform-origin` percentage
  // pair — follows the cursor so the zoom feels anchored to whatever part of
  // the image you're actually looking at, same idea as the gallery's
  // pan-toward-cursor effect.
  const [zoomOrigin, setZoomOrigin] = useState('center center')
  const [isHovering, setIsHovering] = useState(false)
  const hoverZoom = useMotionValue(1)
  const springHoverZoom = useSpring(hoverZoom, ENTRANCE_SPRING)
  const ctrlHeld = useCtrlKeyHeld()

  // Reacts to Ctrl being pressed/released while already hovering (as
  // opposed to the enter/leave handlers below, which only fire on actual
  // pointer transitions) — swaps between the two zoom levels, or back to 1
  // if the cursor isn't over the image at all.
  useEffect(() => {
    if (!motionEnabled) return
    if (!isHovering) {
      hoverZoom.set(1)
      return
    }
    hoverZoom.set(ctrlHeld ? CTRL_ZOOM_SCALE : HOVER_ZOOM_SCALE)
  }, [ctrlHeld, isHovering, motionEnabled, hoverZoom])

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
  }, [closePhotoTab, photo.filePath])

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
          initial={motionEnabled ? { scale: ENTRANCE_SCALE_FROM } : false}
          animate={{ scale: 1 }}
          transition={ENTRANCE_SPRING}
          // Scaling from the left edge (instead of the default center)
          // makes the zoom-settle read as coming in from the left.
          style={{ maxWidth: '100%', maxHeight: '100%', transformOrigin: 'left center' }}
        >
          <motion.div
            onMouseEnter={() => setIsHovering(true)}
            onMouseMove={(event) => {
              if (!motionEnabled) return
              const rect = event.currentTarget.getBoundingClientRect()
              const x = ((event.clientX - rect.left) / rect.width) * 100
              const y = ((event.clientY - rect.top) / rect.height) * 100
              setZoomOrigin(`${x}% ${y}%`)
            }}
            onMouseLeave={() => setIsHovering(false)}
            style={{ scale: springHoverZoom, transformOrigin: zoomOrigin }}
          >
            <Image
              ref={imgRef}
              src={toFileProtocolUrl(photo.filePath, photo.thumbnailKey)}
              alt={photo.fileName}
              fit="contain"
              maw="100%"
              mah="100%"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'center'
              }}
            />
          </motion.div>
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
