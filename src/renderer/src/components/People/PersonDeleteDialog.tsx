import { Text } from '@mantine/core'
import type { ReactElement } from 'react'

import { ConfirmDialog } from '@components'

interface PersonDeleteDialogProps {
  name: string
  opened: boolean
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function PersonDeleteDialog({
  name,
  opened,
  saving,
  onConfirm,
  onCancel
}: PersonDeleteDialogProps): ReactElement {
  return (
    <ConfirmDialog
      title="Delete person"
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
        Its faces become unassigned and eligible to be grouped again on the next scan — this
        doesn&apos;t delete any photos.
      </Text>
    </ConfirmDialog>
  )
}
