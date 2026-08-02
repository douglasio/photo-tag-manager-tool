import { type ReactElement, useState } from 'react'

import { Stack, TextInput } from '@mantine/core'

import { ConfirmDialog } from '@components'

interface TagGroupNameDialogProps {
  title: string
  confirmLabel: string
  opened: boolean
  saving: boolean
  initialName: string
  // Omitted entirely hides the auto-add-pattern field — used for a plain
  // rename, which shouldn't also expose/edit the rule (that's its own
  // context-menu action, see TagGroupPatternDialog). Pass null or a string
  // to show the field (used when creating a group).
  initialMatchPattern?: string | null
  // Other groups' names (excluding the one being renamed, if any) — checked
  // case-insensitively so a new/renamed group can't collide with one already
  // shown in the panel.
  existingNames: string[]
  onConfirm: (name: string, matchPattern: string | null) => void
  onCancel: () => void
}

/** Name-entry shell for "create a tag group" (name + auto-add pattern
 * together) and "rename a tag group" (name only). */
export function TagGroupNameDialog({
  title,
  confirmLabel,
  opened,
  saving,
  initialName,
  initialMatchPattern,
  existingNames,
  onConfirm,
  onCancel
}: TagGroupNameDialogProps): ReactElement {
  const showPattern = initialMatchPattern !== undefined
  const [draft, setDraft] = useState(initialName)
  const [patternDraft, setPatternDraft] = useState(initialMatchPattern ?? '')
  // Adjust-during-render reset for when the dialog is reopened — same
  // pattern used by TagListItem/FolderTree's rename flows.
  const [wasOpened, setWasOpened] = useState(opened)
  if (opened !== wasOpened) {
    setWasOpened(opened)
    if (opened) {
      setDraft(initialName)
      setPatternDraft(initialMatchPattern ?? '')
    }
  }

  const trimmed = draft.trim()
  const isDuplicate = existingNames.some((name) => name.toLowerCase() === trimmed.toLowerCase())
  const error = trimmed.length > 0 && isDuplicate ? 'A group with that name already exists' : null

  const attemptConfirm = (): void => {
    if (!trimmed || isDuplicate) return
    onConfirm(trimmed, patternDraft.trim() || null)
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
      <Stack gap="sm">
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
        {showPattern && (
          <TextInput
            label="Auto-add tags containing"
            description={
              <>
                Optional — any tag with this text anywhere in its name is added here automatically.
                This won&rsquo;t affect tags you move to a group manually.
              </>
            }
            placeholder="e.g. age"
            value={patternDraft}
            onChange={(event) => setPatternDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                attemptConfirm()
              }
            }}
          />
        )}
      </Stack>
    </ConfirmDialog>
  )
}
