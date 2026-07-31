import { type ReactElement, useState } from 'react'

import { EditableText } from './EditableText'
import { InlineEditField } from './InlineEditField'

interface TagDescriptionFieldProps {
  description: string
  onSave: (description: string) => void
}

export function TagDescriptionField({
  description,
  onSave
}: TagDescriptionFieldProps): ReactElement {
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
      <EditableText
        value={description}
        draft={draft}
        editing={editing}
        onDraftChange={setDraft}
        onCommit={commit}
        onCancel={cancel}
        placeholder="Add a description…"
        fz="var(--mantine-font-size-sm)"
        c="dimmed"
        multiline
        maxRows={8}
      />
    </InlineEditField>
  )
}
