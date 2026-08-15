import { Box, Button, Group, Modal } from '@mantine/core'
import type { ReactElement, ReactNode } from 'react'

interface ConfirmDialogProps {
  title: string
  opened: boolean
  saving: boolean
  confirmLabel: string
  confirmColor?: string
  // For a form-shaped dialog (e.g. a name input as children) rather than a
  // pure confirmation — keeps the confirm button inert while its content is invalid.
  confirmDisabled?: boolean
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
  confirmDisabled,
  onConfirm,
  onCancel,
  children
}: ConfirmDialogProps): ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      // Plain text styled to match Title order={3}, not an actual heading —
      // Mantine's Modal already renders its own title prop as an <h2>, so
      // nesting another heading element inside it is invalid HTML.
      title={
        <Box
          component="span"
          fz="var(--mantine-h3-font-size)"
          fw="var(--mantine-h3-font-weight)"
          lh="var(--mantine-h3-line-height)"
        >
          {title}
        </Box>
      }
      centered
    >
      {children}
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          color={confirmColor}
          onClick={onConfirm}
          loading={saving}
          disabled={confirmDisabled}
        >
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  )
}
