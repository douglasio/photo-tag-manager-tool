import { type ReactElement, useState } from 'react'

import { BarChart } from '@mantine/charts'
import { Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'

import { GalleryHoverPreview } from '@components'
import { useKeyHeld } from '@hooks'
import { RADIUS_SIZE } from '@renderer/theme'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { PREVIEW_TRIGGER_KEY } from '@utils'

const TOP_COUNT = 5

interface TopViewedDatum {
  id: string
  fileName: string
  viewCount: number
  thumbnailUrl: string
  photo: PhotoRecord
}

interface HoverState {
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
// component and is threaded in via closure, the same way `previewTriggerHeld`
// and `setHover` are captured below.
function makeImageBarShape(
  previewTriggerHeld: boolean,
  setHover: (hover: HoverState | null) => void
) {
  return function ImageBarShape(props: {
    x?: number
    y?: number
    width?: number
    height?: number
    payload?: TopViewedDatum
  }): ReactElement | null {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props
    if (!payload) return null
    const clipId = `top-viewed-bar-${payload.id}`
    const gradientId = `top-viewed-gradient-${payload.id}`
    return (
      <g
        onMouseMove={(event) => {
          if (previewTriggerHeld) {
            setHover({ id: payload.id, position: { x: event.clientX, y: event.clientY } })
          }
        }}
        onMouseLeave={() => setHover(null)}
        className="dashboard-photo-frame"
        style={{ cursor: previewTriggerHeld ? 'zoom-in' : undefined }}
      >
        <clipPath id={clipId}>
          <rect x={x} y={y} width={Math.max(width, 0)} height={height} rx={6} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="40%" stopColor="black" stopOpacity={0} />
          <stop offset="100%" stopColor="black" stopOpacity={0.75} />
        </linearGradient>
        <image
          href={payload.thumbnailUrl}
          x={x}
          y={y}
          width={Math.max(width, 0)}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
          opacity={0.6}
        />
        <rect
          x={x}
          y={y}
          width={Math.max(width, 0)}
          height={height}
          fill={`url(#${gradientId})`}
          clipPath={`url(#${clipId})`}
          className="dashboard-photo-gradient"
        />
        <text
          x={x + width / 2 + 10}
          y={y + 40}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize={35}
          fontWeight={800}
          fill="white"
          style={{ mixBlendMode: 'luminosity', opacity: 0.6 }}
        >
          {payload.viewCount}
        </text>
      </g>
    )
  }
}

export function TopViewedWidget(): ReactElement {
  const { state } = usePhotoLibrary()
  const previewTriggerHeld = useKeyHeld(PREVIEW_TRIGGER_KEY)
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion
  const [hover, setHover] = useState<HoverState | null>(null)

  // Backstop for an unreliable SVG mouseleave: resets `hover` the instant the
  // trigger key is released, so a stale bar doesn't reopen on the next press.
  const [wasTriggerHeld, setWasTriggerHeld] = useState(previewTriggerHeld)
  if (previewTriggerHeld !== wasTriggerHeld) {
    setWasTriggerHeld(previewTriggerHeld)
    if (!previewTriggerHeld) setHover(null)
  }

  const data: TopViewedDatum[] = Array.from(state.photosByPath.values())
    .filter(
      (photo) => photo.viewCount > 0 && photo.thumbnailStatus === 'ready' && photo.thumbnailKey
    )
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, TOP_COUNT)
    .map((photo) => ({
      id: photo.id,
      fileName: photo.fileName,
      viewCount: photo.viewCount,
      thumbnailUrl: toThumbProtocolUrl(photo.thumbnailKey!),
      photo
    }))

  return (
    <>
      {data.length === 0 ? (
        <Text c="dimmed" size="sm">
          Open some photos from the gallery to see them featured here.
        </Text>
      ) : (
        <BarChart
          h="100%"
          data={data}
          dataKey="fileName"
          orientation="horizontal"
          bg="dark.8"
          bdrs={RADIUS_SIZE}
          series={[{ name: 'viewCount', color: 'blue' }]}
          barProps={{ shape: makeImageBarShape(previewTriggerHeld, setHover), radius: 30 }}
          barChartProps={{ barCategoryGap: 0, margin: { top: 0, bottom: 0 } }}
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
      {data.map((item) => (
        <GalleryHoverPreview
          key={item.id}
          photo={item.photo}
          position={previewTriggerHeld && hover?.id === item.id ? hover.position : null}
          scale={1}
          motionEnabled={motionEnabled}
        />
      ))}
    </>
  )
}
