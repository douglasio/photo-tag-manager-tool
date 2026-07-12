import { Button, Group, Modal } from '@mantine/core'
import type { ReactElement, ReactNode } from 'react'

interface TagConfirmDialogProps {
  title: string
  opened: boolean
  saving: boolean
  confirmLabel: string
  confirmColor?: string
  onConfirm: () => void
  onCancel: () => void
  children: ReactNode
}

/** Shared shell for tag actions that need an explicit "this touches N files" confirmation. */
export function TagConfirmDialog({
  title,
  opened,
  saving,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
  children
}: TagConfirmDialogProps): ReactElement {
  return (
    <Modal opened={opened} onClose={onCancel} title={title} centered>
      {children}
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button color={confirmColor} onClick={onConfirm} loading={saving}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  )
}
