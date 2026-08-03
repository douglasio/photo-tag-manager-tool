import { BarChart } from '@mantine/charts'
import { Paper, Text, Title } from '@mantine/core'
import type { ReactElement } from 'react'

import { toThumbProtocolUrl } from '@shared/protocolUrls'
import { usePhotoLibrary } from '@state'

const TOP_COUNT = 5
const BAR_HEIGHT = 56

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
      />
      <text x={x + width + 8} y={y + height / 2} dominantBaseline="middle" fontSize={12}>
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
    <Paper withBorder p="md">
      <Title order={4} mb="sm">
        Top Viewed
      </Title>
      {data.length === 0 ? (
        <Text c="dimmed" size="sm">
          Open some photos from the gallery to see them featured here.
        </Text>
      ) : (
        <BarChart
          h={data.length * BAR_HEIGHT}
          data={data}
          dataKey="fileName"
          orientation="horizontal"
          series={[{ name: 'viewCount', color: 'blue' }]}
          barProps={{ shape: ImageBarShape, radius: 10 }}
          withXAxis={false}
          withYAxis={false}
          withTooltip={false}
          gridAxis="none"
        />
      )}
    </Paper>
  )
}
