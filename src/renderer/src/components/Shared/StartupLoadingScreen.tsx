import { Center, Group, Loader, Progress, Stack, Text, Title } from '@mantine/core'
import type { ReactElement } from 'react'

import { usePhotoLibrary } from '@state'

// Shown until every watched folder's initial scan resolves, instead of the gallery appearing empty and filling in photo-by-photo as the sync job runs.
export function StartupLoadingScreen(): ReactElement {
  const { state } = usePhotoLibrary()
  const processed = state.photosByPath.size
  const total = state.filesFound
  const percent = total ? Math.round((processed / total) * 100) : 0

  return (
    <Center h="100vh">
      <Stack align="center" gap="xl" w={320}>
        {total > 0 ? (
          <Stack align="center" gap="xs" w="100%">
            <Title>Welcome</Title>
            <Progress value={percent} size="sm" w="100%" animated />
            <Text c="dimmed" size="sm">
              {processed} / {total} photos
            </Text>
          </Stack>
        ) : (
          <Group gap="xs">
            <Loader size="sm" />
            <Text c="dimmed">Loading your library…</Text>
          </Group>
        )}
      </Stack>
    </Center>
  )
}
