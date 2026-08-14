import { Button, Group, RingProgress, Stack, Text } from '@mantine/core'
import type { ReactElement } from 'react'

import type { FaceScanProgress } from '@shared/types'
import { faceScanStepLabel } from '@utils'

interface FaceScanProgressToastProps {
  progress: FaceScanProgress
  onCancel: () => void
}

/** Notification body for the face detection/grouping scan — mirrors
 * AiScanProgressToast's RingProgress + cancel shape. */
export function FaceScanProgressToast({
  progress,
  onCancel
}: FaceScanProgressToastProps): ReactElement {
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
        <Text size="sm">{faceScanStepLabel(progress.phase)}</Text>
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
