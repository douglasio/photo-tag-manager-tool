import { BarChart } from '@mantine/charts'
import { Text } from '@mantine/core'
import type { ReactElement } from 'react'

import { usePhotoLibrary } from '@state'

const TOP_TAG_COUNT = 5

export function TopTagsWidget(): ReactElement {
  const { tagCounts } = usePhotoLibrary()

  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_TAG_COUNT)
    .map(([tag, count]) => ({ tag, count }))

  if (topTags.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Tag some photos to see your most-used tags here.
      </Text>
    )
  }

  return (
    <BarChart
      h="100%"
      data={topTags}
      dataKey="tag"
      orientation="vertical"
      series={[{ name: 'count', color: 'indigo' }]}
      withXAxis={false}
      withTooltip={false}
      gridAxis="none"
    />
  )
}
