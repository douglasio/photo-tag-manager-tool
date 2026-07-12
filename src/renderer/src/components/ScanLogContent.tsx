import {
  Badge,
  Button,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  useMantineTheme
} from '@mantine/core'
import { IconCheck, IconRefresh, IconX } from '@tabler/icons-react'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import type { ThumbnailStatus } from '../../../shared/types'

// Approximate row height (text/badge row + Stack gap), used so the list only
// scrolls once it grows past ~5 visible rows instead of a guessed pixel cap.
const ROW_HEIGHT = 32
const VISIBLE_ROWS = 5

function StatusBadge({
  status,
  fromCache
}: {
  status: ThumbnailStatus
  fromCache: boolean
}): ReactElement {
  const theme = useMantineTheme()

  if (status === 'ready') {
    return (
      <Badge color={fromCache ? 'gray' : 'teal'} variant="light" circle style={{ flexShrink: 0 }}>
        <IconCheck size={theme.spacing.xs} style={{ display: 'block' }} />
      </Badge>
    )
  }
  if (status === 'error') {
    return (
      <Badge color="red" variant="light" circle style={{ flexShrink: 0 }}>
        <IconX size={theme.spacing.xs} style={{ display: 'block' }} />
      </Badge>
    )
  }
  return (
    <Badge color="gray" variant="light" circle style={{ flexShrink: 0 }}>
      <Loader size={theme.spacing.xs} color="gray" type="dots" />
    </Badge>
  )
}

interface ScanLogContentProps {
  onRescan: () => void
}

export function ScanLogContent({ onRescan }: ScanLogContentProps): ReactElement {
  const { photos, state, rescanAll } = usePhotoLibrary()

  const hasEntries = photos.length > 0 || state.errors.length > 0
  const scanning = state.status === 'scanning'

  return (
    <Stack gap="xs">
      <ScrollArea.Autosize mah={ROW_HEIGHT * VISIBLE_ROWS} w={320} scrollbars="y">
        <Stack gap="md" w={320} miw={0}>
          {state.errors.map(({ filePath, message }) => (
            <Stack key={filePath} gap={0} w="100%" miw={0}>
              <Group justify="space-between" wrap="nowrap" gap="md" w="100%" miw={0}>
                <Text truncate="end" title={filePath} miw={0}>
                  {filePath}
                </Text>
                <StatusBadge status="error" fromCache={false} />
              </Group>
              <Text c="red" truncate="end">
                {message}
              </Text>
            </Stack>
          ))}
          {photos.map((photo) => (
            <Group
              key={photo.filePath}
              justify="space-between"
              wrap="nowrap"
              gap="md"
              w="100%"
              miw={0}
            >
              <Text truncate="end" title={photo.filePath} miw={0}>
                {photo.fileName}
              </Text>
              <StatusBadge status={photo.thumbnailStatus} fromCache={photo.fromCache} />
            </Group>
          ))}
          {!hasEntries && <Text c="dimmed">No scan activity yet.</Text>}
        </Stack>
      </ScrollArea.Autosize>
      <Group justify="space-between">
        <Text c="dimmed">({state.cacheHits} from cache)</Text>
        <Button
          variant="light"
          leftSection={<IconRefresh size={14} />}
          loading={scanning}
          disabled={state.folders.length === 0}
          onClick={() => {
            void rescanAll()
            onRescan()
          }}
        >
          Rescan
        </Button>
      </Group>
    </Stack>
  )
}
