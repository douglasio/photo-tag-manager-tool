import { type ReactElement, useEffect, useState } from 'react'

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Image,
  Loader,
  Progress,
  ScrollArea,
  Stack,
  Text,
  Title
} from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'

import { EnableAiFeaturesDialog } from '@components'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { DuplicateGroup } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { aiScanStepLabel } from '@utils'

const THUMB_SIZE = 120

// Opened via the Gallery's "Show duplicates" button (see GalleryGrid) as its
// own tab — runs the shared AI scan on mount/recompute (via rescanAiFeatures,
// which also warms tag suggestions and Time Warp) and renders each resulting
// duplicate cluster as a row of thumbnails.
export function DuplicatesView(): ReactElement {
  const { state, rescanAiFeatures, enableAiFeatures, cancelAiScan, openPhotoTab } =
    usePhotoLibrary()
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [canceled, setCanceled] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  // Duplicate detection rides the same AI model/embeddings as tag
  // suggestions and Time Warp — gated the same way, rather than silently
  // downloading the model in the background the moment this tab opens.
  const [enableAiOpened, setEnableAiOpened] = useState(false)

  // Adjust-during-render (not inside the effect below) the instant
  // "Scan again" bumps scanCount — same pattern useTagSuggestions uses to
  // reset state synchronously without triggering the set-state-in-effect lint rule.
  const [trackedScanCount, setTrackedScanCount] = useState(scanCount)
  if (trackedScanCount !== scanCount) {
    setTrackedScanCount(scanCount)
    setGroups(null)
    setError(null)
    setCanceled(false)
  }

  useEffect(() => {
    if (!state.aiTagSuggestionsEnabled) return
    let cancelled = false
    rescanAiFeatures()
      .then((result) => {
        if (cancelled) return
        setGroups(result.duplicateGroups)
        setCanceled(result.canceled)
      })
      .catch((err: unknown) => {
        console.error('failed to scan for duplicate photos', err)
        if (!cancelled) setError('Failed to scan for duplicate photos.')
      })
    return () => {
      cancelled = true
    }
  }, [rescanAiFeatures, scanCount, state.aiTagSuggestionsEnabled])

  if (!state.aiTagSuggestionsEnabled) {
    return (
      <Center flex={1} mih={0} p="md">
        <Stack align="center" gap="sm" w={360}>
          <Text ta="center" c="dimmed">
            Duplicate detection requires AI features to be enabled.
          </Text>
          <Button onClick={() => setEnableAiOpened(true)}>Enable AI features</Button>
        </Stack>
        <EnableAiFeaturesDialog
          opened={enableAiOpened}
          onCancel={() => setEnableAiOpened(false)}
          onConfirm={enableAiFeatures}
        />
      </Center>
    )
  }

  const progress = state.aiScanProgress
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
          Scan again
        </Button>
      </Group>

      {loading && (
        <Center flex={1} mih={0}>
          <Stack align="center" gap="xl" w={320}>
            {progress ? (
              <Stack align="center" gap="xs" w="100%">
                <Progress
                  value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
                  size="sm"
                  w="100%"
                  animated
                />
                <Text c="dimmed" size="sm">
                  {aiScanStepLabel(progress.phase)}
                </Text>
              </Stack>
            ) : (
              <Loader size="sm" />
            )}
            <Button variant="subtle" color="red" size="xs" onClick={cancelAiScan}>
              Cancel
            </Button>
          </Stack>
        </Center>
      )}

      {error && (
        <Box>
          <Alert display="inline-block" color="red" style={{ flexShrink: 0 }}>
            {error}
          </Alert>
        </Box>
      )}

      {groups && groups.length === 0 && (
        <Text c="dimmed" style={{ flexShrink: 0 }}>
          {canceled ? 'Scan canceled.' : 'No duplicates found.'}
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
