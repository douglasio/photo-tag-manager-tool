import { BarChart } from '@mantine/charts'
import { Text } from '@mantine/core'
import type { ReactElement } from 'react'

import { RADIUS_SIZE } from '@renderer/theme'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import { usePhotoLibrary } from '@state'

const TOP_COUNT = 5

interface TopViewedDatum {
  id: string
  fileName: string
  viewCount: number
  thumbnailUrl: string
}

// Renders each bar's fill as the photo's own thumbnail (cropped to the bar's
// box via preserveAspectRatio="slice", same as CSS object-fit: cover) instead
// of a solid color — Recharts calls this per row with that row's own data as
// `payload`, so no extra lookup is needed to know which photo a given bar is.
function ImageBarShape(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: TopViewedDatum
}): ReactElement | null {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props
  if (!payload) return null
  const clipId = `top-viewed-bar-${payload.id}`
  return (
    <g>
      <clipPath id={clipId}>
        <rect x={x} y={y} width={Math.max(width, 0)} height={height} rx={6} />
      </clipPath>
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

export function TopViewedWidget(): ReactElement {
  const { state } = usePhotoLibrary()

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
      thumbnailUrl: toThumbProtocolUrl(photo.thumbnailKey!)
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
          barProps={{ shape: ImageBarShape, radius: 30 }}
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
    </>
  )
}
