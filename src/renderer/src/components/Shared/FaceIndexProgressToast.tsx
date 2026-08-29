import { Group, RingProgress, Text } from '@mantine/core'
import type { ReactElement } from 'react'

import type { FaceIndexProgress } from '@shared/types'

interface FaceIndexProgressToastProps {
  progress: FaceIndexProgress
}

/** Notification body for the background face indexer — mirrors
 * EmbeddingIndexProgressToast: no cancel button, since pausing this ambient
 * work just re-strands the backlog it's draining. */
export function FaceIndexProgressToast({ progress }: FaceIndexProgressToastProps): ReactElement {
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
        Looking for faces · {progress.done} of {progress.total}
      </Text>
    </Group>
  )
}
