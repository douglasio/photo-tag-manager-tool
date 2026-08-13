import { DonutChart } from '@mantine/charts'
import { Anchor, Stack, Text } from '@mantine/core'
import { useElementSize } from '@mantine/hooks'
import type { ReactElement } from 'react'

import { usePhotoLibrary } from '@state'

// DonutChart's size is a fixed pixel prop, not a percentage — with no cap,
// a short widget (e.g. this capped dashboard row) would have the chart
// spill past the container instead of shrinking to fit. Sized off the
// widget's own measured height, clamped to a sane range, with thickness
// scaled to match (200/50 is DonutChart's own default ratio).
const MAX_CHART_SIZE = 200
const MIN_CHART_SIZE = 90
const NON_CHART_CONTENT_HEIGHT = 70

export function TaggingProgressWidget(): ReactElement {
  const { activePhotosByPath, untaggedCount, setUntaggedFilter, setActiveTab } = usePhotoLibrary()
  const { ref, height } = useElementSize()

  const totalCount = activePhotosByPath.size
  const taggedCount = totalCount - untaggedCount

  if (totalCount === 0) {
    return (
      <Text c="dimmed" size="sm">
        Add some photos to see your tagging progress.
      </Text>
    )
  }

  const goToUntagged = (): void => {
    setUntaggedFilter(true)
    setActiveTab('gallery')
  }

  const chartSize = Math.max(
    MIN_CHART_SIZE,
    Math.min(MAX_CHART_SIZE, height - NON_CHART_CONTENT_HEIGHT)
  )

  return (
    <Stack ref={ref} h="100%" align="center" justify="center" gap="sm">
      <DonutChart
        data={[
          { name: 'Tagged', value: taggedCount, color: 'indigo' },
          { name: 'Untagged', value: untaggedCount, color: 'gray' }
        ]}
        chartLabel={String(totalCount)}
        size={chartSize}
        thickness={chartSize / 4}
        withTooltip={false}
        cellProps={(cell) =>
          cell.name === 'Untagged' && untaggedCount > 0
            ? { onClick: goToUntagged, style: { cursor: 'pointer' } }
            : {}
        }
      />
      <Text size="xs" c="dimmed">
        {taggedCount} of {totalCount} tagged
      </Text>
      {untaggedCount > 0 && (
        <Anchor size="xs" onClick={goToUntagged}>
          View untagged photos
        </Anchor>
      )}
    </Stack>
  )
}
