import { type ReactElement, useEffect, useRef, useState } from 'react'

import type { UsePannableZoomResult } from '@hooks'
import { ActionIcon, Box, Container, Flex, Group, Image, Tooltip } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import {
  IconArmchair,
  IconArticle,
  IconFrame,
  IconMovie,
  IconNews,
  IconRotate,
  IconRotateClockwise,
  IconX
} from '@tabler/icons-react'
import { motion } from 'motion/react'

import { ZoomToolbar } from '@components'
import { usePhotoEntranceExit } from '@hooks'
import { usePhotoHoverEffects } from '@hooks'
import { toFileProtocolUrl } from '@shared/protocolUrls'
import { type PhotoRecord, ROTATABLE_FORMATS, type RotateDirection } from '@shared/types'
import { type PhotoVisualization, usePhotoLibrary } from '@state'

import { ArtGalleryView } from './ArtGalleryView'
import { DvdCoverView } from './DvdCoverView'
import { MagazineCoverView } from './MagazineCoverView'
import { MovieTheaterView } from './MovieTheaterView'
import { NewspaperCoverView } from './NewspaperCoverView'

// 0.5 (not 1) so zooming out can go beyond the fitted size, matching
// usePannableZoom's range — 1 used to double as both "fitted" and "as far
// out as you can go," which left no room to shrink further.
const MIN_SCALE = 0.5
const MAX_SCALE = 5
const SCALE_STEP = 0.25
// Matches the sensitivity used for the gallery's preview-trigger+wheel zoom.
const WHEEL_ZOOM_SENSITIVITY = 0.025
// Short enough to stay responsive during continuous input (wheel, dragging
// the slider) rather than feeling laggy, but still smooths out discrete
// jumps — the toolbar buttons, zoomToFit, zoomToNativeSize, keyboard +/-.
const ZOOM_TRANSITION = 'transform 150ms ease-out'

interface PhotoViewProps {
  photo: PhotoRecord
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

// Mantine doesn't stop Escape from bubbling here, so without this check
// closing a tag dropdown or edit field would also close the whole tab.
function isEditableElement(el: Element | null): boolean {
  if (!el) return false
  return (
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable
  )
}

export function PhotoView({ photo }: PhotoViewProps): ReactElement {
  const {
    state,
    closePhotoTab,
    rotatePhoto,
    visiblePhotos,
    navigateToPhoto,
    consumeNavDirection,
    consumeVisualization,
    incrementViewCount
  } = usePhotoLibrary()
  const [scale, setScale] = useState(1)
  // Read once at mount via lazy initializer, same pattern as enterDirection
  // below — carried across arrow-key navigation's remount so the mode stays
  // active as the user steps through photos.
  const [visualization, setVisualization] = useState<PhotoVisualization>(
    () => consumeVisualization(photo.filePath) ?? 'none'
  )
  // Each theme view owns its own usePannableZoom call (only the active one is
  // ever mounted) and reports it here via onZoomReady, so PhotoView's single
  // footer ZoomToolbar still renders from the same instance the view uses —
  // not a disconnected copy — without instantiating all 5 up front.
  const [activeZoom, setActiveZoom] = useState<UsePannableZoomResult | null>(null)
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

  // Chromium's object-fit ignores EXIF rotation in its own fit/crop math
  // (though painting respects it) — this hidden, unconstrained probe measures
  // the image's true rendered box so we can feed the real aspect-ratio back
  // to the visible images below, overriding what object-fit assumes.
  const [nativeSize, setNativeSize] = useState<{ width: number; height: number } | null>(null)
  // The actual contain-fit pixel size to render the image at, computed once
  // the probe above resolves nativeSize — same approach as usePannableZoom's
  // baseSize. Rendering at this explicit size (rather than maw/mah
  // percentages) is what makes scale=1 mean "fitted": a percentage box has
  // no fitted size of its own to be scale=1 *of*, which is why the image
  // used to open at whatever size the percentages happened to produce
  // instead of the frame-fit size zoomToFit is supposed to return to.
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null)
  // A rotate's spin (see rotationDeg below) needs to *not* animate the one
  // instant it snaps back to 0 once the freshly re-oriented file has actually
  // loaded — otherwise that snap itself would visibly animate backwards. Set
  // alongside rotationDeg in the probe's onLoad below (the browser has
  // already painted the transition-less snap by the time that render
  // commits), then cleared again by this effect right after.
  const [suppressRotationTransition, setSuppressRotationTransition] = useState(false)
  useEffect(() => {
    // Deliberately not "adjusted during render" like measuredForKey below —
    // this needs the browser to actually paint the transition-less snap
    // (true post-commit) before flipping back, which only an effect can do.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (suppressRotationTransition) setSuppressRotationTransition(false)
  }, [suppressRotationTransition])
  // Degrees of *optimistic* rotation applied on top of the image while its
  // rotate round-trip is in flight — see handleRotate. Nonzero doubles as
  // "a rotate is in flight" for the reset below. Settled back to 0 by the
  // probe's onLoad (below) once the real re-oriented file has actually
  // loaded — NOT here on the thumbnailKey data update alone, since that
  // arrives before the browser has fetched/decoded the new file, which was
  // the actual source of the blink: the optimistic rotation used to get
  // cleared while the old, unrotated frame was still the one on screen.
  const [rotationDeg, setRotationDeg] = useState(0)
  // Reset (during render, not an effect, per this codebase's convention for
  // resetting state when an external value changes) whenever the file is
  // rewritten — e.g. after a rotate — so the probe re-measures. Skipped
  // while a rotate is in flight: nativeSize was already optimistically
  // swapped in handleRotate, so clearing it here would hide the image again
  // until the probe's onLoad settles things below.
  const [measuredForKey, setMeasuredForKey] = useState(photo.thumbnailKey)
  if (measuredForKey !== photo.thumbnailKey) {
    setMeasuredForKey(photo.thumbnailKey)
    if (rotationDeg === 0) {
      setNativeSize(null)
      setBaseSize(null)
    }
  }

  const handleRotate = (direction: RotateDirection): void => {
    const delta = direction === 'right' ? 90 : -90
    setRotationDeg((prev) => prev + delta)
    // A rotate is always exactly ±90° — the new native size is deterministically
    // the old one with width/height swapped, so this stays visible (correctly
    // reoriented, via rotationDeg above) instead of blanking out while waiting
    // for the round trip and a fresh async remeasure.
    setNativeSize((prev) => (prev ? { width: prev.height, height: prev.width } : prev))
    void rotatePhoto(photo.filePath, direction).catch(() => {
      // Failed server-side (already notified by context) — undo the
      // optimistic spin/size swap so the view doesn't stay stuck showing a
      // rotation that never actually happened.
      setRotationDeg((prev) => prev - delta)
      setNativeSize((prev) => (prev ? { width: prev.height, height: prev.width } : prev))
    })
  }

  useEffect(() => {
    if (!nativeSize) return
    const container = containerRef.current
    if (!container) return
    // Capped at 1 so a photo smaller than the frame renders at its real
    // size instead of being blurrily upscaled to fill it.
    const containScale = Math.min(
      1,
      container.clientWidth / nativeSize.width,
      container.clientHeight / nativeSize.height
    )
    setBaseSize({
      width: nativeSize.width * containScale,
      height: nativeSize.height * containScale
    })
  }, [nativeSize])

  const zoomToFit = (): void => setScale(1)

  // True 1:1 pixels — the ratio between the probe-measured native size and
  // the fitted size scale=1 already renders at.
  const zoomToNativeSize = (): void => {
    if (!nativeSize || !baseSize) return
    setScale(clampScale(nativeSize.width / baseSize.width))
  }

  // Shared by both the visible image and its saturation-overlay twin so a
  // rotate's spin stays in sync across both — see rotationDeg/handleRotate.
  const imageTransform = `scale(${scale}) rotate(${rotationDeg}deg)`
  const imageTransition = motionEnabled && !suppressRotationTransition ? ZOOM_TRANSITION : undefined

  // This instance mounts exactly once per "opened in a tab" — every opened
  // photo's panel stays mounted for the tab's whole lifetime (see the
  // isActiveRef comment below), so counting on mount (rather than on every
  // activeTab switch) is what makes this "opened," not "switched back to."
  // hasCountedRef (not reset in a cleanup) guards against StrictMode's dev-
  // only mount→cleanup→remount double-invoke: the ref survives that
  // simulated remount, so the second pass sees it already set and skips —
  // an effect cleanup can't fix this itself, since "undoing" the increment
  // there would just let the following remount redo it.
  const hasCountedRef = useRef(false)
  useEffect(() => {
    if (hasCountedRef.current) return
    hasCountedRef.current = true
    void incrementViewCount(photo.filePath)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally once per mount, not on every photo.filePath/incrementViewCount identity change
  }, [])

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
        // App.tsx dispatches a synthetic (untrusted) Escape on every
        // pointerdown to dismiss floating Mantine elements (tooltips,
        // dropdowns) — without this check, clicking a suggested tag badge
        // would close the whole tab before its own click handler ever fires.
        if (!event.isTrusted) return
        if (isEditableElement(document.activeElement)) return
        closePhotoTab(photo.filePath)
        return
      }
      // Alt+arrow switches tabs instead (handled globally in App.tsx).
      if (event.altKey) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Don't steal the keypress from the zoom slider or a focused field
        // (e.g. moving the text cursor while typing a tag).
        if (
          (document.activeElement as HTMLElement | null)?.getAttribute('role') === 'slider' ||
          isEditableElement(document.activeElement)
        ) {
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
    <Container fluid pos="relative" flex={1} mih={0} miw={0} h="100%">
      {visualization !== 'none' ? (
        visualization === 'magazine' ? (
          <MagazineCoverView
            photo={photo}
            onZoomReady={setActiveZoom}
            mastheadTitle={state.magazineTitle}
          />
        ) : visualization === 'newspaper' ? (
          <NewspaperCoverView
            photo={photo}
            onZoomReady={setActiveZoom}
            mastheadTitle={state.newspaperTitle}
          />
        ) : visualization === 'dvd' ? (
          <DvdCoverView
            photo={photo}
            onZoomReady={setActiveZoom}
            studioName={state.dvdStudioName}
          />
        ) : visualization === 'artGallery' ? (
          <ArtGalleryView
            photo={photo}
            onZoomReady={setActiveZoom}
            galleryName={state.artGalleryName}
          />
        ) : (
          <MovieTheaterView
            photo={photo}
            onZoomReady={setActiveZoom}
            studioName={state.dvdStudioName}
          />
        )
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
              if (rotationDeg !== 0) {
                // The freshly re-oriented file has now actually finished
                // loading and painting — only now is it safe to snap the
                // optimistic CSS rotation back to 0 without flashing the old,
                // unrotated frame (see rotationDeg's comment above).
                setSuppressRotationTransition(true)
                setRotationDeg(0)
              }
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
                  w={baseSize?.width}
                  h={baseSize?.height}
                  display="block"
                  style={{
                    visibility: baseSize ? 'visible' : 'hidden',
                    transform: imageTransform,
                    transformOrigin: 'center',
                    transition: imageTransition,
                    userSelect: 'none',
                    WebkitUserDrag: 'none'
                  }}
                />
                {/* Saturated copy masked to a cursor-centered feathered circle;
                    suppressed while the trigger-zoom is active. */}
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
                    w={baseSize?.width}
                    h={baseSize?.height}
                    display="block"
                    style={{
                      visibility: baseSize ? 'visible' : 'hidden',
                      transform: imageTransform,
                      transformOrigin: 'center',
                      transition: imageTransition,
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
            <ActionIcon onClick={() => handleRotate('left')} aria-label="Rotate left">
              <Tooltip label="Rotate left">
                <IconRotate size={18} />
              </Tooltip>
            </ActionIcon>
            <ActionIcon onClick={() => handleRotate('right')} aria-label="Rotate right">
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
          <Tooltip label="DVD cover">
            <ActionIcon
              variant={visualization === 'dvd' ? 'filled' : 'default'}
              aria-label="DVD cover visualization"
              onClick={() => setVisualization('dvd')}
            >
              <IconMovie size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Art gallery">
            <ActionIcon
              variant={visualization === 'artGallery' ? 'filled' : 'default'}
              aria-label="Art gallery visualization"
              onClick={() => setVisualization('artGallery')}
            >
              <IconFrame size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Movie theater">
            <ActionIcon
              variant={visualization === 'movieTheater' ? 'filled' : 'default'}
              aria-label="Movie theater visualization"
              onClick={() => setVisualization('movieTheater')}
            >
              <IconArmchair size={18} />
            </ActionIcon>
          </Tooltip>
          {visualization !== 'none' && (
            <Tooltip label="Standard view">
              <ActionIcon
                variant="filled"
                color="red"
                aria-label="Exit visualization view"
                onClick={() => setVisualization('none')}
              >
                <IconX size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
        {visualization === 'none' ? (
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
        ) : (
          // activeZoom is set synchronously (useLayoutEffect, in each theme
          // view) before this ever paints, so it's only null for one commit.
          activeZoom && (
            <ZoomToolbar
              scale={activeZoom.scale}
              onScaleChange={activeZoom.setScale}
              onZoomToFit={activeZoom.zoomToFit}
              onZoomToNativeSize={activeZoom.zoomToNativeSize}
              onZoomOut={activeZoom.zoomOut}
              onZoomIn={activeZoom.zoomIn}
              min={activeZoom.min}
              max={activeZoom.max}
            />
          )
        )}
      </Flex>
    </Container>
  )
}
