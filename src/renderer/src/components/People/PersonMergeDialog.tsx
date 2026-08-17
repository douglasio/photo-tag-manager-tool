import { Text } from '@mantine/core'
import type { ReactElement } from 'react'

import { ConfirmDialog } from '@components'

interface PersonMergeDialogProps {
  sourceName: string
  targetName: string
  opened: boolean
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Confirms before combining two person groups — more consequential than a
// single face assignment (deletes a whole person row), so it gets the same
// explicit "this touches N things" treatment as PersonDeleteDialog.
export function PersonMergeDialog({
  sourceName,
  targetName,
  opened,
  saving,
  onConfirm,
  onCancel
}: PersonMergeDialogProps): ReactElement {
  return (
    <ConfirmDialog
      title="Merge people"
      opened={opened}
      saving={saving}
      confirmLabel="Merge"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <Text size="sm">
        Merge{' '}
        <Text span fw={700}>
          {sourceName}
        </Text>{' '}
        into{' '}
        <Text span fw={700}>
          {targetName}
        </Text>
        ?
      </Text>
      <Text c="dimmed" size="sm" mt="xs">
        All of {sourceName}&apos;s faces move to {targetName}, and the {sourceName} entry is removed
        — no photos or faces are deleted.
      </Text>
    </ConfirmDialog>
  )
}
