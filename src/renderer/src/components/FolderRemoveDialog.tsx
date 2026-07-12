import { Text } from '@mantine/core'
import type { ReactElement } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { basename } from '../utils/folderTree'

interface FolderRemoveDialogProps {
  folder: string
  count: number
  opened: boolean
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function FolderRemoveDialog({
  folder,
  count,
  opened,
  saving,
  onConfirm,
  onCancel
}: FolderRemoveDialogProps): ReactElement {
  return (
    <ConfirmDialog
      title="Remove folder"
      opened={opened}
      saving={saving}
      confirmLabel="Remove"
      confirmColor="red"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <Text>
        Remove{' '}
        <Text span fw={700}>
          {basename(folder)}
        </Text>
        ?
      </Text>
      <Text c="dimmed" mt="xs">
        This will remove the folder and{' '}
        <Text span fw={700}>
          {count} photo{count === 1 ? '' : 's'}
        </Text>{' '}
        from the library.
      </Text>
      <Text c="dimmed" mt="xs">
        The original files on disk are not affected.
      </Text>
    </ConfirmDialog>
  )
}
