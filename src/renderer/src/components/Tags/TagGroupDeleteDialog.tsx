import { Text } from '@mantine/core'
import type { ReactElement } from 'react'

import { ConfirmDialog } from '@components'

interface TagGroupDeleteDialogProps {
  name: string
  opened: boolean
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function TagGroupDeleteDialog({
  name,
  opened,
  saving,
  onConfirm,
  onCancel
}: TagGroupDeleteDialogProps): ReactElement {
  return (
    <ConfirmDialog
      title="Delete tag group"
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
          {name}
        </Text>
        ?
      </Text>
      <Text c="dimmed" size="sm" mt="xs">
        Its tags will move to &quot;Other Tags&quot; — this only removes the group, not any tags or
        photos.
      </Text>
    </ConfirmDialog>
  )
}
