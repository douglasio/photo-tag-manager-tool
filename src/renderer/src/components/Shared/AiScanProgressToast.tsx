import { Button, Group, RingProgress, Stack, Text } from '@mantine/core'
import type { ReactElement } from 'react'

import type { AiScanProgress } from '@shared/types'
import { aiScanStepLabel } from '@utils'

interface AiScanProgressToastProps {
  progress: AiScanProgress
  onCancel: () => void
}

/** Notification body for the shared "enable AI features" scan (model
 * download, then embedding, then duplicate clustering) — mirrors
 * MoveProgressToast's RingProgress, shown regardless of which component
 * (Settings, Time Warp, Duplicates) kicked the scan off. */
export function AiScanProgressToast({
  progress,
  onCancel
}: AiScanProgressToastProps): ReactElement {
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <Stack gap="xs">
      <Group gap="sm" wrap="nowrap">
        <RingProgress
          size={36}
          thickness={4}
          roundCaps
          sections={[{ value: percent, color: 'indigo' }]}
        />
        <Text size="sm">{aiScanStepLabel(progress.phase)}</Text>
      </Group>
      <Button
        size="compact-xs"
        variant="subtle"
        color="gray"
        onClick={onCancel}
        style={{ alignSelf: 'flex-start' }}
      >
        Cancel
      </Button>
    </Stack>
  )
}
