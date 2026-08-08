import { DonutChart } from '@mantine/charts'
import { Group, Stack, Text } from '@mantine/core'
import type { ReactElement } from 'react'

import { QuickTagWidget } from '@components'
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
    <Group wrap="nowrap" className="flex-fill" justify="space-around">
      <Stack h="100%" align="center" justify="center" gap="sm" style={{ flexShrink: 0 }}>
        <DonutChart
          data={[
            { name: 'Tagged', value: taggedCount, color: 'indigo' },
            { name: 'Untagged', value: untaggedCount, color: 'gray' }
          ]}
          chartLabel={String(photos.length)}
          size={200}
          thickness={50}
          withTooltip={false}
        />
        <Text size="xs" c="dimmed">
          {taggedCount} of {photos.length} tagged
        </Text>
      </Stack>
      <QuickTagWidget />
    </Group>
  )
}
