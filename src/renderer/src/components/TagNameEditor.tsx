import { Group, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState, type ReactElement } from 'react'
import { InlineEditField } from './InlineEditField'
import { TagRenameDialog } from './TagRenameDialog'

interface TagNameEditorProps {
  tag: string
  count: number
  onRename: (newTag: string) => Promise<void>
}

export function TagNameEditor({ tag, count, onRename }: TagNameEditorProps): ReactElement {
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

  const handleCancelConfirm = (): void => {
    setConfirming(false)
    setDraft(tag)
    setEditing(false)
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
        {editing ? (
          <Group gap={2} wrap="nowrap" align="center">
            <Text
              fw={700}
              style={{
                flexShrink: 0,
                fontSize: 'var(--mantine-h2-font-size)',
                lineHeight: 'var(--mantine-h2-line-height)'
              }}
            >
              #
            </Text>
            <TextInput
              autoFocus
              variant="unstyled"
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onBlur={attemptSave}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  attemptSave()
                } else if (event.key === 'Escape') {
                  setDraft(tag)
                  setEditing(false)
                }
              }}
              style={{ flex: 1, minWidth: 0 }}
              styles={{
                input: {
                  fontWeight: 700,
                  fontSize: 'var(--mantine-h2-font-size)',
                  lineHeight: 'var(--mantine-h2-line-height)',
                  padding: 0,
                  height: 'auto',
                  minHeight: 'auto'
                }
              }}
            />
          </Group>
        ) : (
          <Title
            order={2}
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            #{tag}
          </Title>
        )}
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
