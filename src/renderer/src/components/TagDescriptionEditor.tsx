import { Text, Textarea } from '@mantine/core'
import { useState, type ReactElement } from 'react'
import { InlineEditField } from './InlineEditField'

interface TagDescriptionEditorProps {
  description: string
  onSave: (description: string) => void
}

export function TagDescriptionEditor({
  description,
  onSave
}: TagDescriptionEditorProps): ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(description)

  const startEdit = (): void => {
    setDraft(description)
    setEditing(true)
  }

  const commit = (): void => {
    setEditing(false)
    if (draft !== description) onSave(draft)
  }

  const cancel = (): void => {
    setDraft(description)
    setEditing(false)
  }

  return (
    <InlineEditField editing={editing} onStartEdit={startEdit}>
      {editing ? (
        <Textarea
          autoFocus
          autosize
          minRows={1}
          maxRows={8}
          variant="unstyled"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              cancel()
            } else if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              commit()
            }
          }}
          placeholder="Add a description…"
          styles={{ input: { padding: 0, fontSize: 'var(--mantine-font-size-sm)' } }}
        />
      ) : (
        <Text
          c="dimmed"
          size="sm"
          fs={description ? undefined : 'italic'}
          style={{ whiteSpace: 'pre-line', opacity: description ? 1 : 0.5 }}
        >
          {description || 'Add a description…'}
        </Text>
      )}
    </InlineEditField>
  )
}
