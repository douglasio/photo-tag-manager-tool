import { Group, RingProgress, Text } from '@mantine/core'
import type { ReactElement } from 'react'

import type { EmbeddingIndexProgress } from '@shared/types'

interface EmbeddingIndexProgressToastProps {
  progress: EmbeddingIndexProgress
}

/** Notification body for the background embedding indexer — quieter than
 * AiScanProgressToast (no cancel button, since pausing this ambient work
 * just re-strands the backlog it's draining rather than stopping anything
 * meaningful). */
export function EmbeddingIndexProgressToast({
  progress
}: EmbeddingIndexProgressToastProps): ReactElement {
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <Group gap="sm" wrap="nowrap">
      <RingProgress
        size={36}
        thickness={4}
        roundCaps
        sections={[{ value: percent, color: 'indigo' }]}
      />
      <Text size="sm">
        Indexing photos for visual search · {progress.done} of {progress.total}
      </Text>
    </Group>
  )
}
