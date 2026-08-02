import { type ReactElement, useState } from 'react'

import { TextInput } from '@mantine/core'

import { ConfirmDialog } from '@components'

interface TagGroupPatternDialogProps {
  opened: boolean
  saving: boolean
  initialMatchPattern: string | null
  onConfirm: (matchPattern: string | null) => void
  onCancel: () => void
}

/** Editing-only shell for a tag group's auto-add rule, reached via its
 * context menu — separate from renaming, so adjusting the rule doesn't
 * require touching the group's name. */
export function TagGroupPatternDialog({
  opened,
  saving,
  initialMatchPattern,
  onConfirm,
  onCancel
}: TagGroupPatternDialogProps): ReactElement {
  const [draft, setDraft] = useState(initialMatchPattern ?? '')
  // Adjust-during-render reset for when the dialog is reopened — same
  // pattern used by TagListItem/FolderTree's rename flows.
  const [wasOpened, setWasOpened] = useState(opened)
  if (opened !== wasOpened) {
    setWasOpened(opened)
    if (opened) setDraft(initialMatchPattern ?? '')
  }

  const attemptConfirm = (): void => onConfirm(draft.trim() || null)

  return (
    <ConfirmDialog
      title="Auto-add rule"
      opened={opened}
      saving={saving}
      confirmLabel="Save"
      onConfirm={attemptConfirm}
      onCancel={onCancel}
    >
      <TextInput
        autoFocus
        label="Auto-add tags containing"
        description={
          'Optional — any tag with this text anywhere in its name is added here ' +
          "automatically. Tags you've manually moved are never pulled back by this."
        }
        placeholder="e.g. age"
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
