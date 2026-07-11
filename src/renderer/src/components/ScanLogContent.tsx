import { Badge, Group, ScrollArea, Stack, Text } from '@mantine/core'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import type { ThumbnailStatus } from '../../../shared/types'

// Approximate row height (text/badge row + Stack gap), used so the list only
// scrolls once it grows past ~5 visible rows instead of a guessed pixel cap.
const ROW_HEIGHT = 32
const VISIBLE_ROWS = 5

function StatusBadge({ status }: { status: ThumbnailStatus }): ReactElement {
  if (status === 'ready') {
    return (
      <Badge color="teal" variant="light" circle>
        ✓
      </Badge>
    )
  }
  if (status === 'error') {
    return (
      <Badge color="red" variant="light" circle>
        ✕
      </Badge>
    )
  }
  return (
    <Badge color="gray" variant="light">
      pending
    </Badge>
  )
}

export function ScanLogContent(): ReactElement {
  const { photos, state } = usePhotoLibrary()

  const hasEntries = photos.length > 0 || state.errors.length > 0

  return (
    <ScrollArea.Autosize mah={ROW_HEIGHT * VISIBLE_ROWS} w={320} scrollbars="y">
      <Stack gap="md">
        {state.errors.map(({ filePath, message }) => (
          <Stack key={filePath} gap={0} miw={0}>
            <Group justify="space-between" wrap="nowrap" gap="md">
              <Text truncate="end" title={filePath} miw={0}>
                {filePath}
              </Text>
              <StatusBadge status="error" />
            </Group>
            <Text c="red" truncate="end">
              {message}
            </Text>
          </Stack>
        ))}
        {photos.map((photo) => (
          <Group key={photo.filePath} justify="space-between" wrap="nowrap" gap="md">
            <Text truncate="end" title={photo.filePath} miw={0}>
              {photo.fileName}
            </Text>
            <StatusBadge status={photo.thumbnailStatus} />
          </Group>
        ))}
        {!hasEntries && <Text c="dimmed">No scan activity yet.</Text>}
      </Stack>
    </ScrollArea.Autosize>
  )
}
