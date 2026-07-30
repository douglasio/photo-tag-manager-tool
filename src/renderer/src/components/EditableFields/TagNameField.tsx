import { Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState, type ReactElement } from 'react'
import { InlineEditField } from './InlineEditField'
import { EditableText } from './EditableText'
import { TagRenameDialog } from '../Tags/TagRenameDialog'

interface TagNameFieldProps {
  tag: string
  count: number
  onRename: (newTag: string) => Promise<void>
}

const TAG_NAME_FONT_SIZE = 'var(--mantine-h2-font-size)'

export function TagNameField({ tag, count, onRename }: TagNameFieldProps): ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tag)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const trimmed = draft.trim()
  const canAttemptSave = trimmed.length > 0 && trimmed !== tag

  const startEdit = (): void => {
    setDraft(tag)
    setEditing(true)
  }

  const attemptSave = (): void => {
    if (confirming) return
    if (!canAttemptSave) {
      setDraft(tag)
      setEditing(false)
      return
    }
    setConfirming(true)
  }

  const cancel = (): void => {
    setDraft(tag)
    setEditing(false)
  }

  const handleCancelConfirm = (): void => {
    setConfirming(false)
    cancel()
  }

  const handleConfirm = async (): Promise<void> => {
    setSaving(true)
    try {
      await onRename(trimmed)
      setConfirming(false)
      setEditing(false)
      notifications.show({
        color: 'teal',
        message: `Updated tag name for ${count} photo${count === 1 ? '' : 's'}`
      })
    } catch {
      // onRename already surfaces an error toast — leave the dialog open so
      // the user can retry or cancel.
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <InlineEditField editing={editing} onStartEdit={startEdit}>
        <Group gap={2} wrap="nowrap" align="center">
          {editing && (
            <Text fw={700} fz={TAG_NAME_FONT_SIZE} style={{ flexShrink: 0 }}>
              #
            </Text>
          )}
          <EditableText
            // "#tag" combined while reading, so the "#" is part of the same
            // element as the name (no separate Text sibling to keep aligned
            // against a Textarea's own box model) — a fixed "#" prefix next
            // to the input only while editing, since the draft itself is
            // just the bare tag name.
            value={`#${tag}`}
            draft={draft}
            editing={editing}
            onDraftChange={setDraft}
            onCommit={attemptSave}
            onCancel={cancel}
            fz={TAG_NAME_FONT_SIZE}
            fw={700}
            truncate
          />
        </Group>
      </InlineEditField>
      <TagRenameDialog
        oldTag={tag}
        newTag={trimmed}
        count={count}
        opened={confirming}
        saving={saving}
        onConfirm={() => void handleConfirm()}
        onCancel={handleCancelConfirm}
      />
    </>
  )
}
