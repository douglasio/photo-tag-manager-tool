import { type ReactElement, useState } from 'react'

import { BarChart } from '@mantine/charts'
import { DEFAULT_THEME, Text } from '@mantine/core'

import { toThumbProtocolUrl } from '@shared/protocolUrls'
import { usePhotoLibrary } from '@state'
import { shuffle } from '@utils'

const TOP_TAG_COUNT = 5
// Reserved space for the tag-name column — without an explicit width here,
// a long tag name has no bound and can spill past the chart's own left edge.
const Y_AXIS_WIDTH = 110
// A rough (not pixel-measured) character cap for what fits in that width at
// the tick's font size — SVG text has no CSS text-overflow/ellipsis, so
// truncation has to happen on the string itself before rendering it.
const MAX_LABEL_CHARS = 14
// How many candidate photos are locked in per tag — the bar shows however
// many of these actually fit at BLOCK_WIDTH, cycling back through the list
// if the bar is wider than the candidate count.
const MAX_CANDIDATE_PHOTOS = 8
// Target width per photo block — the bar's actual block count is derived
// from this (barWidth / BLOCK_WIDTH, rounded), so a longer bar naturally
// shows more blocks.
const BLOCK_WIDTH = 36
const BLOCK_GAP = 2

export interface TopTagDatum {
  tag: string
  count: number
  // Empty until this tag's photos are picked (see TopTagsWidget below) —
  // the bar falls back to a solid color for that one render.
  thumbnailUrls: string[]
}

function truncateLabel(value: string): string {
  if (value.length <= MAX_LABEL_CHARS) return value
  return `${value.slice(0, MAX_LABEL_CHARS - 1)}…`
}

// Renders the Y-axis tag label as clickable text, same navigation as the bar
// itself — Recharts calls tick renderers as plain functions with the axis
// value already resolved, so no extra data lookup is needed.
// eslint-disable-next-line react-refresh/only-export-components -- exported for direct unit testing, colocated by design
export function makeTagTick(onSelect: (tag: string) => void) {
  return function TagTick(props: {
    x?: number | string
    y?: number | string
    payload?: { value?: string }
  }): ReactElement | null {
    const { x = 0, y = 0, payload } = props
    if (!payload?.value) return null
    return (
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fontSize={DEFAULT_THEME.fontSizes.sm}
        fill="var(--mantine-color-dimmed)"
        style={{ cursor: 'pointer' }}
        onClick={() => onSelect(payload.value!)}
      >
        {truncateLabel(payload.value)}
      </text>
    )
  }
}

// Fills the bar with same-width photo "blocks" built up left-to-right from
// the tag's own tagged photos, like TopViewedWidget's image-filled bars but
// tiled instead of a single stretched image. Falls back to a solid color
// bar if no candidate photos are available yet.
// eslint-disable-next-line react-refresh/only-export-components -- exported for direct unit testing, colocated by design
export function makeCountBarShape(onSelect: (tag: string) => void) {
  return function CountBarShape(props: {
    x?: number
    y?: number
    width?: number
    height?: number
    payload?: TopTagDatum
  }): ReactElement | null {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props
    if (!payload) return null
    const barWidth = Math.max(width, 0)
    const urls = payload.thumbnailUrls
    // payload.tag can contain spaces/slashes/etc — invalid raw in a
    // url(#id) reference (see TopViewedWidget's makeImageBarShape).
    const safeTag = payload.tag.replace(/[^a-zA-Z0-9_-]/g, '_')
    const clipId = `top-tags-bar-${safeTag}`
    const gradientId = `top-tags-gradient-${safeTag}`
    // Not capped by urls.length — a tag with fewer candidate photos than
    // fit at BLOCK_WIDTH just cycles back through the ones it has.
    const numBlocks = urls.length > 0 ? Math.max(1, Math.round(barWidth / BLOCK_WIDTH)) : 0
    const blockWidth = numBlocks > 0 ? barWidth / numBlocks : 0
    // Same clamp as TopViewedWidget's makeImageBarShape — keeps the count
    // centered on a normal bar but still inside a very short one.
    const textOffset = height >= 52 ? 40 : height >= 20 ? height - 17 : height / 2
    const textY = numBlocks > 0 ? y + textOffset : y + height / 2

    return (
      <g
        onClick={() => onSelect(payload.tag)}
        style={{ cursor: 'pointer' }}
        className={numBlocks > 0 ? 'top-tags-bar dashboard-photo-frame' : 'top-tags-bar'}
      >
        <clipPath id={clipId}>
          <rect x={x} y={y} width={barWidth} height={height} rx={6} />
        </clipPath>
        {numBlocks > 0 ? (
          <>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="40%" stopColor="black" stopOpacity={1} />
              <stop offset="100%" stopColor="black" stopOpacity={0.9} />
            </linearGradient>
            <g clipPath={`url(#${clipId})`}>
              {Array.from({ length: numBlocks }, (_, index) => {
                const blockX = x + index * blockWidth
                return (
                  <image
                    key={index}
                    href={urls[index % urls.length]}
                    x={blockX + BLOCK_GAP / 2}
                    y={y}
                    width={Math.max(blockWidth - BLOCK_GAP, 1)}
                    height={height}
                    preserveAspectRatio="xMidYMid slice"
                  />
                )
              })}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                fill={`url(#${gradientId})`}
                className="dashboard-photo-gradient"
              />
            </g>
          </>
        ) : (
          <rect
            className="top-tags-bar-rect"
            x={x}
            y={y}
            width={barWidth}
            height={height}
            rx={6}
            fill="var(--mantine-color-indigo-6)"
          />
        )}
        <text
          x={x + barWidth - 10}
          y={textY}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize={35}
          fill="white"
        >
          {payload.count}
        </text>
      </g>
    )
  }
}

export function TopTagsWidget(): ReactElement {
  const { activePhotosByPath, tagCounts, setTagFilter, setActiveTab } = usePhotoLibrary()

  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_TAG_COUNT)
    .map(([tag, count]) => ({ tag, count }))

  // Locked in per tag (lazily, one at a time) rather than recomputed every
  // render — a fresh shuffle each render would otherwise reshuffle every
  // bar's blocks on any unrelated library change while the dashboard sits open.
  const [photosByTag, setPhotosByTag] = useState<Record<string, string[]>>({})
  const missingTag = topTags.find((datum) => !photosByTag[datum.tag])
  if (missingTag) {
    const candidates = shuffle(
      Array.from(activePhotosByPath.values()).filter(
        (photo) =>
          photo.tags.includes(missingTag.tag) &&
          photo.thumbnailStatus === 'ready' &&
          photo.thumbnailKey
      )
    )
      .slice(0, MAX_CANDIDATE_PHOTOS)
      .map((photo) => toThumbProtocolUrl(photo.thumbnailKey!))
    setPhotosByTag((prev) => ({ ...prev, [missingTag.tag]: candidates }))
  }

  const data: TopTagDatum[] = topTags.map((datum) => ({
    ...datum,
    thumbnailUrls: photosByTag[datum.tag] ?? []
  }))

  if (data.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Tag some photos to see your most-used tags here.
      </Text>
    )
  }

  const goToTag = (tag: string): void => {
    setTagFilter(tag)
    setActiveTab('gallery')
  }

  return (
    <BarChart
      h="100%"
      data={data}
      dataKey="tag"
      orientation="vertical"
      series={[{ name: 'count', color: 'indigo' }]}
      barProps={{ shape: makeCountBarShape(goToTag) }}
      withXAxis={false}
      withTooltip={false}
      gridAxis="none"
      yAxisProps={{ tick: makeTagTick(goToTag), width: Y_AXIS_WIDTH }}
    />
  )
}
