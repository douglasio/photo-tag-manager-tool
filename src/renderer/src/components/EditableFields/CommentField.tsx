import { type ReactElement, useState } from 'react'

import { Blockquote } from '@mantine/core'
import { IconMessage } from '@tabler/icons-react'

import { useCommitEdit } from '@hooks'

import { EditableText } from './EditableText'
import { InlineEditField } from './InlineEditField'

interface CommentFieldProps {
  value: string | null
  displayValue: string
  onSave: (comment: string) => Promise<void>
}

const COMMENT_MAX_LENGTH = 32000 // exif max limit

export function CommentField({ value, onSave }: CommentFieldProps): ReactElement {
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

  return (
    <InlineEditField editing={editing} onStartEdit={startEdit}>
      <Blockquote icon={<IconMessage stroke={1} size={20} />} iconSize={30} ml={5} px="md" py="sm">
        <EditableText
          value={value ?? ''}
          draft={draft}
          editing={editing}
          onDraftChange={setDraft}
          onCommit={commit}
          onCancel={cancel}
          placeholder="Add a comment…"
          multiline
          maxRows={8}
          maxLength={COMMENT_MAX_LENGTH}
        />
      </Blockquote>
    </InlineEditField>
  )
}
