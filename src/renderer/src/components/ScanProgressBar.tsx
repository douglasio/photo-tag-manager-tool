import { Button, Group, Progress, Text } from '@mantine/core'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'

export function ScanProgressBar(): ReactElement | null {
  const { state, cancelScan } = usePhotoLibrary()

  if (state.status === 'idle') return null

  const processed = state.photosByPath.size
  const total = state.filesFound

  return (
    <Group gap="sm" wrap="nowrap">
      {state.status === 'scanning' && (
        <>
          <Progress value={total ? (processed / total) * 100 : 0} size="sm" w={120} />
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {processed} / {total || '…'} found
          </Text>
          <Button size="xs" variant="subtle" color="red" onClick={() => void cancelScan()}>
            Cancel
          </Button>
        </>
      )}
      {state.status === 'complete' && (
        <Text size="xs" c="dimmed">
          Done — {total} photos ({state.cacheHits} from cache)
          {state.errors.length > 0 && `, ${state.errors.length} error(s)`}
        </Text>
      )}
      {state.status === 'canceled' && (
        <Text size="xs" c="dimmed">
          Scan canceled ({processed} loaded)
        </Text>
      )}
    </Group>
  )
}
