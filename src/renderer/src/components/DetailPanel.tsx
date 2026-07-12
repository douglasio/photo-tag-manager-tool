import { Center, Group, Stack, Text, Title } from '@mantine/core'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { TagList } from './TagList'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function DetailRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Group justify="space-between" wrap="nowrap" gap="md" align="flex-start">
      <Text c="dimmed" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text ta="right" style={{ wordBreak: 'break-word' }}>
        {value}
      </Text>
    </Group>
  )
}

export function DetailPanel(): ReactElement {
  const { selectedPhoto } = usePhotoLibrary()

  if (!selectedPhoto) {
    return (
      <Center h="100%">
        <Text c="dimmed" ta="center">
          Select a photo to see its details
        </Text>
      </Center>
    )
  }

  const { metadata } = selectedPhoto

  return (
    <Stack gap="lg">
      <Title order={2} size="h4" style={{ wordBreak: 'break-word' }}>
        {selectedPhoto.fileName}
      </Title>

      <Stack gap="xs">
        <Text fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Tags
        </Text>
        <TagList tags={selectedPhoto.tags} />
      </Stack>

      <Stack gap="xs">
        <Text fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Metadata
        </Text>
        <Stack gap={6}>
          <DetailRow label="Date taken" value={metadata.dateTaken ?? '—'} />
          <DetailRow
            label="Camera"
            value={[metadata.cameraMake, metadata.cameraModel].filter(Boolean).join(' ') || '—'}
          />
          <DetailRow
            label="Dimensions"
            value={
              metadata.widthPx && metadata.heightPx
                ? `${metadata.widthPx} × ${metadata.heightPx}`
                : '—'
            }
          />
          <DetailRow label="File size" value={formatBytes(metadata.fileSizeBytes)} />
          <DetailRow label="Format" value={metadata.format} />
        </Stack>
        <Text c="dimmed" style={{ wordBreak: 'break-word' }}>
          {selectedPhoto.filePath}
        </Text>
      </Stack>

      {metadata.comment && (
        <Stack gap="xs">
          <Text fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Comment
          </Text>
          <Text style={{ wordBreak: 'break-word' }}>{metadata.comment}</Text>
        </Stack>
      )}
    </Stack>
  )
}
