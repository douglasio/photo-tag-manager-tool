import { Button, Group, Modal, Title } from '@mantine/core'
import type { ReactElement, ReactNode } from 'react'

interface ConfirmDialogProps {
  title: string
  opened: boolean
  saving: boolean
  confirmLabel: string
  confirmColor?: string
  onConfirm: () => void
  onCancel: () => void
  children: ReactNode
}

/** Shared shell for any action that needs an explicit "this touches N things" confirmation. */
export function ConfirmDialog({
  title,
  opened,
  saving,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
  children
}: ConfirmDialogProps): ReactElement {
  return (
    <Modal opened={opened} onClose={onCancel} title={<Title order={3}>{title}</Title>} centered>
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
