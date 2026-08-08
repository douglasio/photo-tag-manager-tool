import { Button, Group, RingProgress, Stack, Text } from '@mantine/core'
import type { ReactElement } from 'react'

interface TimeWarpProgressToastProps {
  done: number
  total: number
  onCancel: () => void
}

/** Notification body for the Throwback widget's opt-in "Time Warp" library
 * scan, mirroring MoveProgressToast's RingProgress. */
export function TimeWarpProgressToast({
  done,
  total,
  onCancel
}: TimeWarpProgressToastProps): ReactElement {
  const percent = total ? Math.round((done / total) * 100) : 0

  return (
    <Stack gap="xs">
      <Group gap="sm" wrap="nowrap">
        <RingProgress
          size={36}
          thickness={4}
          roundCaps
          sections={[{ value: percent, color: 'indigo' }]}
        />
        <Text size="sm">
          Scanning your library… {done} / {total} photo{total === 1 ? '' : 's'}
        </Text>
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
