import { Text } from '@mantine/core'
import type { ReactElement } from 'react'

import { ConfirmDialog } from '@components'

interface PersonHideDialogProps {
  name: string
  opened: boolean
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function PersonHideDialog({
  name,
  opened,
  saving,
  onConfirm,
  onCancel
}: PersonHideDialogProps): ReactElement {
  return (
    <ConfirmDialog
      title="Hide person"
      opened={opened}
      saving={saving}
      confirmLabel="Hide"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <Text size="sm">
        Hide{' '}
        <Text span fw={700}>
          {name}
        </Text>
        ?
      </Text>
      <Text c="dimmed" size="sm" mt="xs">
        Their photo matches stay grouped together just hidden. Un-hide this person in Settings →
        People.
      </Text>
    </ConfirmDialog>
  )
}
