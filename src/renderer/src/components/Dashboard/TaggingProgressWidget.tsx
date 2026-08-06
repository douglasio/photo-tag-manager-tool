import { DonutChart } from '@mantine/charts'
import { Stack, Text } from '@mantine/core'
import type { ReactElement } from 'react'

import { usePhotoLibrary } from '@state'

export function TaggingProgressWidget(): ReactElement {
  const { state } = usePhotoLibrary()

  const photos = Array.from(state.photosByPath.values())
  const taggedCount = photos.filter((photo) => photo.tags.length > 0).length
  const untaggedCount = photos.length - taggedCount

  if (photos.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Add some photos to see your tagging progress.
      </Text>
    )
  }

  return (
    <Stack h="100%" align="center" justify="center" gap={4}>
      <DonutChart
        data={[
          { name: 'Tagged', value: taggedCount, color: 'indigo' },
          { name: 'Untagged', value: untaggedCount, color: 'gray' }
        ]}
        chartLabel={String(photos.length)}
        size={140}
        thickness={20}
        withTooltip
      />
      <Text size="xs" c="dimmed">
        {taggedCount} of {photos.length} tagged
      </Text>
    </Stack>
  )
}
