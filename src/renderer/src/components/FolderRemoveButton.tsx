import { ActionIcon, Tooltip } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useState, type ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { FolderRemoveDialog } from './FolderRemoveDialog'

interface FolderRemoveButtonProps {
  folder: string
  count: number
}

export function FolderRemoveButton({ folder, count }: FolderRemoveButtonProps): ReactElement {
  const { removeFolder } = usePhotoLibrary()
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  const handleConfirm = async (): Promise<void> => {
    setRemoving(true)
    try {
      await removeFolder(folder)
      setConfirming(false)
    } catch {
      // removeFolder already surfaces an error toast — leave the dialog open
      // so the user can retry or cancel.
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <Tooltip label="Remove folder">
        <ActionIcon
          variant="subtle"
          color="red"
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${folder}`}
        >
          <IconTrash size="70%" />
        </ActionIcon>
      </Tooltip>
      <FolderRemoveDialog
        folder={folder}
        count={count}
        opened={confirming}
        saving={removing}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
