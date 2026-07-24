import { Blockquote, Text, Textarea } from '@mantine/core'
import { useState, type ReactElement } from 'react'
import { InlineEditField } from '../Shared/InlineEditField'
import { useCommitEdit } from '../../hooks/useCommitEdit'
import { IconMessage } from '@tabler/icons-react'

interface CommentEditorProps {
  value: string | null
  displayValue: string
  onSave: (comment: string) => Promise<void>
}

export function CommentEditor({ value, onSave }: CommentEditorProps): ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const commitSave = useCommitEdit(onSave, setEditing)

  const startEdit = (): void => {
    setDraft(value ?? '')
    setEditing(true)
  }

  // Enter and blur can both reach commit() — useCommitEdit's re-entrancy
  // guard covers a blur firing mid-save (e.g. right after Enter) so it
  // can't trigger a second, redundant save of the same draft.
  const commit = (): void => {
    if (draft === (value ?? '')) {
      setEditing(false)
      return
    }
    void commitSave(draft)
  }

  const cancel = (): void => {
    setDraft(value ?? '')
    setEditing(false)
  }

  const maxLength = 32000 // exif max limit

  const blockquoteProps = {
    icon: <IconMessage stroke={1} size={20} />,
    iconSize: 30,
    ml: 5
  }

  return (
    <InlineEditField editing={editing} onStartEdit={startEdit}>
      {editing ? (
        <Blockquote {...blockquoteProps}>
          <Textarea
            autoFocus
            autosize
            minRows={1}
            maxRows={8}
            maxLength={maxLength}
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
            styles={{ input: { padding: 0 } }}
          />
        </Blockquote>
      ) : value ? (
        <Blockquote {...blockquoteProps}>{value}</Blockquote>
      ) : (
        <Text c="dimmed">Add a comment…</Text>
      )}
    </InlineEditField>
  )
}
