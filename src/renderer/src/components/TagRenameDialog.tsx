import { Text } from '@mantine/core'
import type { ReactElement } from 'react'
import { TagConfirmDialog } from './TagConfirmDialog'

interface TagRenameDialogProps {
  oldTag: string
  newTag: string
  count: number
  opened: boolean
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function TagRenameDialog({
  oldTag,
  newTag,
  count,
  opened,
  saving,
  onConfirm,
  onCancel
}: TagRenameDialogProps): ReactElement {
  return (
    <TagConfirmDialog
      title="Rename tag"
      opened={opened}
      saving={saving}
      confirmLabel="Rename"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <Text size="sm">
        Rename{' '}
        <Text span fw={700}>
          #{oldTag}
        </Text>{' '}
        to{' '}
        <Text span fw={700}>
          #{newTag}
        </Text>
        ?
      </Text>
      <Text c="dimmed" size="sm" mt="xs">
        This will update the tag on {count} photo{count === 1 ? '' : 's'} — the change is written
        directly into each photo file&apos;s metadata and can&apos;t be automatically undone.
      </Text>
    </TagConfirmDialog>
  )
}
