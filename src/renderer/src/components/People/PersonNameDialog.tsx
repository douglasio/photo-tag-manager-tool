import { type ReactElement, useState } from 'react'

import { TextInput } from '@mantine/core'

import { ConfirmDialog } from '@components'

interface PersonNameDialogProps {
  opened: boolean
  saving: boolean
  initialName: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

// Mirrors TagGroupNameDialog, minus the auto-add-pattern field a person has
// no equivalent of.
export function PersonNameDialog({
  opened,
  saving,
  initialName,
  onConfirm,
  onCancel
}: PersonNameDialogProps): ReactElement {
  const [draft, setDraft] = useState(initialName)
  const [wasOpened, setWasOpened] = useState(opened)
  if (opened !== wasOpened) {
    setWasOpened(opened)
    if (opened) setDraft(initialName)
  }

  const trimmed = draft.trim()
  const attemptConfirm = (): void => {
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <ConfirmDialog
      title="Rename person"
      opened={opened}
      saving={saving}
      confirmLabel="Rename"
      confirmDisabled={!trimmed}
      onConfirm={attemptConfirm}
      onCancel={onCancel}
    >
      <TextInput
        autoFocus
        label="Name"
        placeholder="e.g. Jamie"
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            attemptConfirm()
          }
        }}
      />
    </ConfirmDialog>
  )
}
