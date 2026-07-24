import { Group, RingProgress, Text } from '@mantine/core'
import type { ReactElement } from 'react'

interface MoveProgressToastProps {
  completed: number
  total: number
}

/** Notification body for a folder-drop move-in-progress, mirroring ScanProgressBar's RingProgress. */
export function MoveProgressToast({ completed, total }: MoveProgressToastProps): ReactElement {
  const percent = total ? Math.round((completed / total) * 100) : 0

  return (
    <Group gap="sm" wrap="nowrap">
      <RingProgress
        size={36}
        thickness={4}
        roundCaps
        sections={[{ value: percent, color: 'indigo' }]}
      />
      <Text size="sm">
        Moving {completed} / {total} photo{total === 1 ? '' : 's'}…
      </Text>
    </Group>
  )
}
