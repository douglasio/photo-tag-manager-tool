import { ActionIcon, Tooltip } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconTrash } from '@tabler/icons-react'
import { useState, type ReactElement } from 'react'
import { TagDeleteDialog } from './TagDeleteDialog'

interface TagDeleteButtonProps {
  tag: string
  count: number
  onDelete: () => Promise<void>
}

export function TagDeleteButton({ tag, count, onDelete }: TagDeleteButtonProps): ReactElement {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { hovered, ref } = useHover<HTMLButtonElement>()

  const handleConfirm = async (): Promise<void> => {
    setDeleting(true)
    try {
      await onDelete()
      setConfirming(false)
      notifications.show({
        color: 'teal',
        message: `Deleted tag "${tag}" from ${count} photo${count === 1 ? '' : 's'}`
      })
    } catch {
      // onDelete already surfaces an error toast — leave the dialog open so
      // the user can retry or cancel.
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Tooltip label="Delete tag">
        <ActionIcon
          ref={ref}
          color="red"
          size="md"
          style={{
            opacity: hovered ? 0.7 : 0.25
          }}
          onClick={() => setConfirming(true)}
          aria-label="Delete tag"
        >
          <IconTrash size={18} />
        </ActionIcon>
      </Tooltip>
      <TagDeleteDialog
        tag={tag}
        count={count}
        opened={confirming}
        saving={deleting}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
