import { type ReactElement, useState } from 'react'

import { TextInput } from '@mantine/core'

import { ConfirmDialog } from '@components'

interface TagGroupNameDialogProps {
  title: string
  confirmLabel: string
  opened: boolean
  saving: boolean
  initialName: string
  // Other groups' names (excluding the one being renamed, if any) — checked
  // case-insensitively so a new/renamed group can't collide with one already
  // shown in the panel.
  existingNames: string[]
  onConfirm: (name: string) => void
  onCancel: () => void
}

/** Shared name-entry shell for both "create a tag group" and "rename a tag group". */
export function TagGroupNameDialog({
  title,
  confirmLabel,
  opened,
  saving,
  initialName,
  existingNames,
  onConfirm,
  onCancel
}: TagGroupNameDialogProps): ReactElement {
  const [draft, setDraft] = useState(initialName)
  // Adjust-during-render reset for when the dialog is reopened — same
  // pattern used by TagListItem/FolderTree's rename flows.
  const [wasOpened, setWasOpened] = useState(opened)
  if (opened !== wasOpened) {
    setWasOpened(opened)
    if (opened) setDraft(initialName)
  }

  const trimmed = draft.trim()
  const isDuplicate = existingNames.some((name) => name.toLowerCase() === trimmed.toLowerCase())
  const error = trimmed.length > 0 && isDuplicate ? 'A group with that name already exists' : null

  const attemptConfirm = (): void => {
    if (!trimmed || isDuplicate) return
    onConfirm(trimmed)
  }

  return (
    <ConfirmDialog
      title={title}
      opened={opened}
      saving={saving}
      confirmLabel={confirmLabel}
      confirmDisabled={!trimmed || isDuplicate}
      onConfirm={attemptConfirm}
      onCancel={onCancel}
    >
      <TextInput
        autoFocus
        label="Group name"
        placeholder="e.g. People"
        value={draft}
        error={error}
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
