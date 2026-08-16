import { Group, Loader, Progress, Stack, Text } from '@mantine/core'

interface ScanProgressIndicatorProps {
  // null when progress can't be measured yet — shows a bare spinner instead of a bar.
  percent: number | null
  label?: string
}

// Shared "waiting on a background scan" shape: a progress bar + label once
// there's something to measure, a spinner (+ optional label) before that.
export function ScanProgressIndicator({
  percent,
  label
}: ScanProgressIndicatorProps): React.JSX.Element {
  if (percent === null) {
    return (
      <Group gap="xs">
        <Loader size="sm" />
        {label && <Text c="dimmed">{label}</Text>}
      </Group>
    )
  }
  return (
    <Stack align="center" gap="xs" w="100%">
      <Progress value={percent} size="sm" w="100%" animated />
      {label && (
        <Text c="dimmed" size="sm">
          {label}
        </Text>
      )}
    </Stack>
  )
}
