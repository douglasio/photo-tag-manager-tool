import { Anchor, Card, Progress, Stack, Text } from '@mantine/core'
import type { ReactElement } from 'react'

import { usePhotoLibrary } from '@state'

export function TaggingProgressWidget(): ReactElement {
  const { activePhotosByPath, untaggedCount, setUntaggedFilter, setActiveTab } = usePhotoLibrary()

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

  return (
    <Stack h="100%" justify="center" align="stretch" gap="sm">
      <Card radius="md" padding="xl" bg="var(--mantine-color-body)">
        <Text fz="lg" fw={500}>
          {taggedCount} of {totalCount} tagged
        </Text>
        <Progress
          value={(taggedCount / totalCount) * 100}
          mt="md"
          size="lg"
          radius="xl"
          color="indigo"
          aria-label="Tagging progress"
        />

        {taggedCount === totalCount && <Text mt="md">Nice work!</Text>}
      </Card>

      {untaggedCount > 0 && (
        <Anchor size="xs" onClick={goToUntagged} style={{ alignSelf: 'center' }}>
          View untagged photos
        </Anchor>
      )}
    </Stack>
  )
}
