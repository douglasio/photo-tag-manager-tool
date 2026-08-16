import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react'

import { BarChart } from '@mantine/charts'
import { Stack, Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'

import { GalleryHoverPreview } from '@components'
import { useKeyHeld } from '@hooks'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { useGalleryLibrary, useLibraryActions } from '@state'
import { PREVIEW_TRIGGER_KEY } from '@utils'

import { useDashboardPreviewScale } from './DashboardPreviewZoomContext'

const TOP_COUNT = 5

export interface TopViewedDatum {
  id: string
  fileName: string
  viewCount: number
  // null for a padding placeholder — see the comment on `data` below.
  thumbnailUrl: string | null
  photo: PhotoRecord | null
}

export interface HoverState {
  id: string
  position: { x: number; y: number }
}

// Renders each bar's fill as the photo's own thumbnail (cropped to the bar's
// box via preserveAspectRatio="slice", same as CSS object-fit: cover) instead
// of a solid color — Recharts calls this per row with that row's own data as
// `payload`, so no extra lookup is needed to know which photo a given bar is.
//
// Recharts invokes this as a plain function (not via React.createElement), so
// it can't call hooks itself — hover state instead lives in the parent
// component and is threaded in via closure, the same way `previewTriggerHeld`,
// `onHoverMove`, and `onHoverLeave` are captured below.
//
// `onHoverMove` always records the latest position (even while the preview
// trigger isn't held) so the parent has a last-known position to hydrate
// from the instant the trigger key is pressed — without that, the preview
// wouldn't appear until the next actual mouse movement after the keypress,
// since a stationary cursor never fires another mousemove event on its own.
// eslint-disable-next-line react-refresh/only-export-components -- exported for direct unit testing, colocated by design
export function makeImageBarShape(
  previewTriggerHeld: boolean,
  onHoverMove: (hover: HoverState) => void,
  onHoverLeave: () => void,
  onOpen: (datum: TopViewedDatum) => void
) {
  return function ImageBarShape(props: {
    x?: number
    y?: number
    width?: number
    height?: number
    payload?: TopViewedDatum
  }): ReactElement | null {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props
    // Padding categories (see `data` below) render nothing — they exist only
    // to reserve a category slot so real bars keep a consistent width.
    if (!payload?.thumbnailUrl) return null
    const barWidth = Math.max(width, 0)
    // payload.id is the photo's full file path — spaces, parens, and other
    // characters that are perfectly valid there break a url(#id) reference
    // when used raw as an SVG element id, silently failing to resolve the
    // clip/gradient for just that bar while "clean" filenames work fine.
    const safeId = payload.id.replace(/[^a-zA-Z0-9_-]/g, '_')
    const clipId = `top-viewed-bar-${safeId}`
    const gradientId = `top-viewed-gradient-${safeId}`
    // 40px from the top on a tall bar; 12px above the bottom edge once the
    // bar's too short for that; dead-center once it's too short even for
    // that — guarantees the text always stays within [y, y + height].
    const textOffset = height >= 52 ? 40 : height >= 20 ? height - 17 : height / 2
    const textY = y + textOffset
    return (
      <g
        onClick={() => onOpen(payload)}
        onMouseMove={(event) => {
          onHoverMove({ id: payload.id, position: { x: event.clientX, y: event.clientY } })
        }}
        onMouseLeave={onHoverLeave}
        className="dashboard-photo-frame"
        style={{ cursor: previewTriggerHeld ? 'zoom-in' : 'pointer' }}
      >
        {/* Rounding lives ONLY on the clip region — giving the gradient
            rect its own rx too, on top of the clip, was the bug: with a
            fill="url(#...)" gradient, Chromium was rendering that rx as if
            it were 0, so the gradient (and only the gradient) came out
            square despite being clipped to the same rounded path. */}
        <clipPath id={clipId}>
          <rect x={x} y={y} width={barWidth} height={height} rx={6} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="40%" stopColor="black" stopOpacity={0.85} />
          <stop offset="100%" stopColor="black" stopOpacity={0.7} />
        </linearGradient>
        <image
          href={payload.thumbnailUrl}
          x={x}
          y={y}
          width={barWidth}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
        <rect
          x={x}
          y={y}
          width={barWidth}
          height={height}
          fill={`url(#${gradientId})`}
          clipPath={`url(#${clipId})`}
          className="dashboard-photo-gradient"
        />
        <text
          x={x + barWidth / 2}
          y={textY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={35}
          fill="white"
        >
          {payload.viewCount}
        </text>
      </g>
    )
  }
}

export function TopViewedWidget(): ReactElement {
  const { state, activePhotosByPath } = useGalleryLibrary()
  const { openPhotoTab } = useLibraryActions()
  const previewTriggerHeld = useKeyHeld(PREVIEW_TRIGGER_KEY)
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion
  const [hover, setHover] = useState<HoverState | null>(null)
  const previewScale = useDashboardPreviewScale()
  // Mirrors the latest hovered bar/position on every mouse move regardless
  // of whether the trigger key is held — a ref write alone doesn't
  // re-render, so this is already up to date the instant the trigger flips
  // on, rather than waiting for the next mouse movement to catch up.
  const hoverRef = useRef<HoverState | null>(null)

  // Hydrates `hover` from the ref the instant the trigger key is pressed
  // (rising edge) so the preview appears immediately even if the cursor
  // hasn't moved since; clears it the instant the key is released (falling
  // edge) as a backstop for an unreliable SVG mouseleave. A ref read has to
  // happen in an effect, not during render itself.
  useEffect(() => {
    setHover(previewTriggerHeld ? hoverRef.current : null)
  }, [previewTriggerHeld])

  const handleHoverMove = (next: HoverState): void => {
    hoverRef.current = next
    if (previewTriggerHeld) setHover(next)
  }

  const handleHoverLeave = (): void => {
    hoverRef.current = null
    setHover(null)
  }

  const viewedPhotos = useMemo(
    () =>
      Array.from(activePhotosByPath.values())
        .filter(
          (photo) => photo.viewCount > 0 && photo.thumbnailStatus === 'ready' && photo.thumbnailKey
        )
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, TOP_COUNT),
    [activePhotosByPath]
  )

  // Padded out to a full TOP_COUNT categories — with fewer real bars, the
  // category axis stretches each one to fill the available width, making a
  // library with only 1-2 viewed photos look broken (two oversized bars)
  // rather than just sparse.
  const data: TopViewedDatum[] = useMemo(
    () =>
      Array.from({ length: TOP_COUNT }, (_, index) => {
        const photo = viewedPhotos[index]
        if (!photo) {
          return {
            id: `placeholder-${index}`,
            fileName: `placeholder-${index}`,
            viewCount: 0,
            thumbnailUrl: null,
            photo: null
          }
        }
        return {
          id: photo.id,
          fileName: photo.fileName,
          viewCount: photo.viewCount,
          thumbnailUrl: toThumbProtocolUrl(photo.thumbnailKey!),
          photo
        }
      }),
    [viewedPhotos]
  )

  return (
    <Stack h="100%" gap={4}>
      {viewedPhotos.length === 0 ? (
        <Text c="dimmed" size="sm">
          Open some photos from the gallery to see them featured here.
        </Text>
      ) : (
        <BarChart
          style={{ flex: 1, minHeight: 0 }}
          data={data}
          dataKey="fileName"
          orientation="horizontal"
          series={[{ name: 'viewCount', color: 'blue' }]}
          barProps={{
            /* eslint-disable react-hooks/refs -- handleHoverMove/handleHoverLeave
               close over hoverRef, but only ever run later from Recharts' own
               mouse event callbacks, never synchronously during this render. */
            shape: makeImageBarShape(
              previewTriggerHeld,
              handleHoverMove,
              handleHoverLeave,
              (datum) => {
                if (datum.photo) openPhotoTab(datum.photo.filePath)
              }
            )
            /* eslint-enable react-hooks/refs */
          }}
          barChartProps={{ barCategoryGap: '6%', margin: { top: 0, bottom: 0 } }}
          // With orientation="horizontal", Mantine's BarChart puts the value
          // axis on Y (X carries the category/dataKey) — bars actually grow
          // upward from a baseline. Without this, Recharts "nicely" rounds
          // the auto-computed Y max up for tick generation (even with the
          // axis hidden), leaving every bar short of the chart's top edge.
          yAxisProps={{ domain: [0, 'dataMax'] }}
          withXAxis={false}
          withYAxis={false}
          withTooltip={false}
          gridAxis="none"
        />
      )}
      {viewedPhotos.length > 0 && viewedPhotos.length < TOP_COUNT && (
        <Text c="dimmed" size="xs" style={{ flexShrink: 0 }}>
          {viewedPhotos.length} of {TOP_COUNT} photos viewed
        </Text>
      )}
      {viewedPhotos.map((photo) => (
        <GalleryHoverPreview
          key={photo.id}
          photo={photo}
          position={previewTriggerHeld && hover?.id === photo.id ? hover.position : null}
          scale={previewScale}
          motionEnabled={motionEnabled}
        />
      ))}
    </Stack>
  )
}
