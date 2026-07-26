import { ActionIcon, Box, Container, Flex, Group, Image, Portal, Tooltip } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { motion } from 'motion/react'
import {
  IconArticle,
  IconNews,
  IconPhotoStar,
  IconRotate,
  IconRotateClockwise,
  IconX
} from '@tabler/icons-react'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ROTATABLE_FORMATS, type PhotoRecord } from '../../../../shared/types'
import { toFileProtocolUrl } from '../../../../shared/protocolUrls'
import { usePhotoLibrary, type PhotoVisualization } from '../../state/PhotoLibraryContext'
import { usePhotoEntranceExit } from '../../hooks/usePhotoEntranceExit'
import { usePhotoHoverEffects } from '../../hooks/usePhotoHoverEffects'
import { usePannableZoom } from '../../hooks/usePannableZoom'
import { ZoomToolbar } from '../Shared/ZoomToolbar'
import { MagazineCoverView } from './MagazineCoverView'
import { NewspaperCoverView } from './NewspaperCoverView'

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
  const {
    state,
    closePhotoTab,
    rotatePhoto,
    visiblePhotos,
    navigateToPhoto,
    consumeNavDirection,
    consumeVisualization
  } = usePhotoLibrary()
  const [scale, setScale] = useState(1)
  // Read once at mount via lazy initializer, same pattern as enterDirection
  // below — carried across arrow-key navigation's remount so the mode stays
  // active as the user steps through photos.
  const [visualization, setVisualization] = useState<PhotoVisualization>(
    () => consumeVisualization(photo.filePath) ?? 'none'
  )
  // Always called (not just while a given mode is active) so these stay the
  // single source of truth for each view's zoom — PhotoView renders its
  // ZoomToolbar from them directly, rather than each owning a disconnected copy.
  const magazineZoom = usePannableZoom(photo, { defaultFit: 'cover' })
  const newspaperZoom = usePannableZoom(photo, { defaultFit: 'cover' })
  // Read once at mount via lazy initializer — this instance is fresh per photo.
  const [enterDirection] = useState(() => consumeNavDirection(photo.filePath))
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  // Tracks the whole PhotoView pane's own box (tabs above, details panel to
  // the right already excluded by AppShell's layout) so the Portal-rendered
  // exit button below can be pinned to ITS actual top-right corner rather
  // than a guessed viewport offset.
  const paneRef = useRef<HTMLDivElement>(null)
  const [paneCorner, setPaneCorner] = useState<{ top: number; right: number } | null>(null)
  useEffect(() => {
    if (visualization === 'none') return
    const el = paneRef.current
    if (!el) return
    const updateCorner = (): void => {
      const rect = el.getBoundingClientRect()
      setPaneCorner({ top: rect.top, right: window.innerWidth - rect.right })
    }
    updateCorner()
    const observer = new ResizeObserver(updateCorner)
    observer.observe(el)
    return () => observer.disconnect()
  }, [visualization])
  const canRotate = ROTATABLE_FORMATS.includes(photo.metadata.format)
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion

  const { initial, animate, transition, handleImageLoad, triggerExit } = usePhotoEntranceExit({
    motionEnabled,
    enterDirection
  })
  const { saturationAmount, containerHandlers, zoomStyle, saturationOverlayStyle } =
    usePhotoHoverEffects(motionEnabled)

  // Chromium's object-fit ignores EXIF rotation in its own fit/crop math
  // (though painting respects it) — this hidden, unconstrained probe measures
  // the image's true rendered box so we can feed the real aspect-ratio back
  // to the visible images below, overriding what object-fit assumes.
  const [nativeSize, setNativeSize] = useState<{ width: number; height: number } | null>(null)
  // Reset (during render, not an effect, per this codebase's convention for
  // resetting state when an external value changes) whenever the file is
  // rewritten — e.g. after a rotate — so the probe re-measures.
  const [measuredForKey, setMeasuredForKey] = useState(photo.thumbnailKey)
  if (measuredForKey !== photo.thumbnailKey) {
    setMeasuredForKey(photo.thumbnailKey)
    setNativeSize(null)
  }
  const aspectRatio = nativeSize ? `${nativeSize.width} / ${nativeSize.height}` : undefined

  const zoomToFit = (): void => setScale(MIN_SCALE)

  // True 1:1 pixels, using the probe-measured size above rather than
  // naturalWidth/naturalHeight (see the comment on nativeSize).
  const zoomToNativeSize = (): void => {
    const container = containerRef.current
    if (!container || !nativeSize) return
    const fitScale = Math.min(
      container.clientWidth / nativeSize.width,
      container.clientHeight / nativeSize.height
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
          navigateToPhoto(photo.filePath, toPath, direction, visualization)
          return
        }
        // Play the exit animation first, navigate once it finishes.
        triggerExit(direction, () =>
          navigateToPhoto(photo.filePath, toPath, direction, visualization)
        )
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
  }, [
    closePhotoTab,
    photo.filePath,
    visiblePhotos,
    navigateToPhoto,
    motionEnabled,
    triggerExit,
    visualization
  ])

  return (
    <Container ref={paneRef} fluid pos="relative" flex={1} mih={0} miw={0} h="100%">
      {visualization !== 'none' ? (
        <>
          {visualization === 'magazine' ? (
            <MagazineCoverView photo={photo} zoom={magazineZoom} />
          ) : (
            <NewspaperCoverView photo={photo} zoom={newspaperZoom} />
          )}
          {/* AppShell's Header/Navbar/Aside are all position:fixed with
              their own z-index tier, which can sit above ordinary absolutely
              positioned content in Main regardless of DOM order — a Portal
              (rendered straight to document.body, same as the drag preview
              in App.tsx and the Ctrl+hover preview in PhotoThumbnail.tsx)
              plus the app's own "definitely on top" z-index token sidesteps
              that entirely instead of trying to out-stack it locally.
              Positioned from paneCorner (this pane's own measured
              top-right), so it lands exactly where the tab row and details
              panel edge intersect rather than a guessed offset. */}
          {paneCorner && (
            <Portal>
              <Tooltip label="Standard view">
                <ActionIcon
                  variant="filled"
                  size="lg"
                  pos="fixed"
                  top={paneCorner.top + 8}
                  right={paneCorner.right + 8}
                  style={{ zIndex: 'var(--mantine-z-index-max)' }}
                  aria-label="Exit visualization view"
                  onClick={() => setVisualization('none')}
                >
                  <IconX size={20} />
                </ActionIcon>
              </Tooltip>
            </Portal>
          )}
        </>
      ) : (
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
          <Image
            src={toFileProtocolUrl(photo.filePath, photo.thumbnailKey)}
            alt=""
            aria-hidden="true"
            pos="absolute"
            maw="none"
            mah="none"
            style={{ visibility: 'hidden' }}
            onLoad={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              setNativeSize({ width: rect.width, height: rect.height })
            }}
          />
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
                  draggable={false}
                  maw="100%"
                  mah="100%"
                  display="block"
                  style={{
                    aspectRatio,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center',
                    userSelect: 'none',
                    WebkitUserDrag: 'none'
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
                    draggable={false}
                    maw="100%"
                    mah="100%"
                    display="block"
                    style={{
                      aspectRatio,
                      transform: `scale(${scale})`,
                      transformOrigin: 'center',
                      filter: `saturate(${saturationAmount})`,
                      userSelect: 'none',
                      WebkitUserDrag: 'none'
                    }}
                  />
                </motion.div>
              </motion.div>
            </Box>
          </motion.div>
        </Container>
      )}
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
          <Tooltip label="Magazine cover">
            <ActionIcon
              variant={visualization === 'magazine' ? 'filled' : 'default'}
              aria-label="Magazine cover visualization"
              onClick={() => setVisualization('magazine')}
            >
              <IconNews size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Newspaper cover">
            <ActionIcon
              variant={visualization === 'newspaper' ? 'filled' : 'default'}
              aria-label="Newspaper cover visualization"
              onClick={() => setVisualization('newspaper')}
            >
              <IconArticle size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Coming soon">
            <ActionIcon variant="default" disabled aria-label="More visualizations coming soon">
              <IconPhotoStar size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
        {visualization === 'magazine' ? (
          <ZoomToolbar
            scale={magazineZoom.scale}
            onScaleChange={magazineZoom.setScale}
            onZoomToFit={magazineZoom.zoomToFit}
            onZoomToNativeSize={magazineZoom.zoomToNativeSize}
            onZoomOut={magazineZoom.zoomOut}
            onZoomIn={magazineZoom.zoomIn}
            min={magazineZoom.min}
            max={magazineZoom.max}
          />
        ) : visualization === 'newspaper' ? (
          <ZoomToolbar
            scale={newspaperZoom.scale}
            onScaleChange={newspaperZoom.setScale}
            onZoomToFit={newspaperZoom.zoomToFit}
            onZoomToNativeSize={newspaperZoom.zoomToNativeSize}
            onZoomOut={newspaperZoom.zoomOut}
            onZoomIn={newspaperZoom.zoomIn}
            min={newspaperZoom.min}
            max={newspaperZoom.max}
          />
        ) : (
          <ZoomToolbar
            scale={scale}
            onScaleChange={setScale}
            onZoomToFit={zoomToFit}
            onZoomToNativeSize={zoomToNativeSize}
            onZoomOut={() => setScale((prev) => clampScale(prev - SCALE_STEP))}
            onZoomIn={() => setScale((prev) => clampScale(prev + SCALE_STEP))}
            min={MIN_SCALE}
            max={MAX_SCALE}
          />
        )}
      </Flex>
    </Container>
  )
}
