import { type ReactElement, useEffect, useState } from 'react'

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Progress,
  ScrollArea,
  Stack,
  Text,
  Title
} from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'

import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { DuplicateGroup } from '@shared/types'
import { usePhotoLibrary } from '@state'

const THUMB_SIZE = 120

// Opened via the Gallery's "Show duplicates" button (see GalleryGrid) as its
// own tab — runs findDuplicateGroups on mount/recompute and renders each
// resulting cluster as a row of thumbnails.
export function DuplicatesView(): ReactElement {
  const { state, findDuplicateGroups, openPhotoTab } = usePhotoLibrary()
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanCount, setScanCount] = useState(0)

  // Adjust-during-render (not inside the effect below) the instant
  // "Recompute" bumps scanCount — same pattern useTagSuggestions uses to
  // reset state synchronously without triggering the set-state-in-effect lint rule.
  const [trackedScanCount, setTrackedScanCount] = useState(scanCount)
  if (trackedScanCount !== scanCount) {
    setTrackedScanCount(scanCount)
    setGroups(null)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false
    findDuplicateGroups()
      .then((result) => {
        if (!cancelled) setGroups(result)
      })
      .catch((err: unknown) => {
        console.error('failed to scan for duplicate photos', err)
        if (!cancelled) setError('Failed to scan for duplicate photos.')
      })
    return () => {
      cancelled = true
    }
  }, [findDuplicateGroups, scanCount])

  const progress = state.duplicateScanProgress
  const loading = groups === null && !error

  return (
    <Stack flex={1} mih={0} p="md">
      <Group justify="space-between" style={{ flexShrink: 0 }}>
        <Title order={2} size="h3">
          Duplicate Photos
        </Title>
        <Button
          leftSection={<IconRefresh size={14} />}
          variant="default"
          disabled={loading}
          onClick={() => setScanCount((count) => count + 1)}
        >
          Recompute
        </Button>
      </Group>

      {loading && (
        <Stack gap={4} style={{ flexShrink: 0 }}>
          <Progress
            value={progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
            animated
          />
          <Text size="xs" c="dimmed">
            {progress?.phase === 'comparing' ? 'Comparing photos' : 'Analyzing photos'}…{' '}
            {progress?.done ?? 0}/{progress?.total ?? 0}
          </Text>
        </Stack>
      )}

      {error && (
        <Alert color="red" style={{ flexShrink: 0 }}>
          {error}
        </Alert>
      )}

      {groups && groups.length === 0 && (
        <Text c="dimmed" style={{ flexShrink: 0 }}>
          No duplicates found.
        </Text>
      )}

      {groups && groups.length > 0 && (
        <ScrollArea flex={1} mih={0}>
          <Stack gap="md" pr="md">
            {groups.map((group) => (
              <Card key={group.filePaths[0]} withBorder>
                <Group gap="xs" mb="xs">
                  <Badge variant="light">{group.filePaths.length} photos</Badge>
                  <Badge variant="light" color="grape">
                    {Math.round(group.similarity * 100)}% similar
                  </Badge>
                </Group>
                <Group gap="xs">
                  {group.filePaths.map((filePath) => {
                    const photo = state.photosByPath.get(filePath)
                    if (!photo?.thumbnailKey) return null
                    return (
                      <Image
                        key={filePath}
                        src={toThumbProtocolUrl(photo.thumbnailKey)}
                        alt={photo.fileName}
                        w={THUMB_SIZE}
                        h={THUMB_SIZE}
                        fit="cover"
                        radius="sm"
                        style={{ cursor: 'pointer' }}
                        onClick={() => openPhotoTab(filePath)}
                      />
                    )
                  })}
                </Group>
              </Card>
            ))}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  )
}
