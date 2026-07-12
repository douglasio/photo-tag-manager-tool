import { Text } from '@mantine/core'
import type { ReactElement } from 'react'
import { TagConfirmDialog } from './TagConfirmDialog'

interface TagDeleteDialogProps {
  tag: string
  count: number
  opened: boolean
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function TagDeleteDialog({
  tag,
  count,
  opened,
  saving,
  onConfirm,
  onCancel
}: TagDeleteDialogProps): ReactElement {
  return (
    <TagConfirmDialog
      title="Delete tag"
      opened={opened}
      saving={saving}
      confirmLabel="Delete"
      confirmColor="red"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <Text size="sm">
        Delete{' '}
        <Text span fw={700}>
          #{tag}
        </Text>
        ?
      </Text>
      <Text c="dimmed" size="sm" mt="xs">
        This will remove the tag from {count} photo{count === 1 ? '' : 's'} — the change is written
        directly into each photo file&apos;s metadata and can&apos;t be automatically undone.
      </Text>
    </TagConfirmDialog>
  )
}
