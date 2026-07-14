import { Group, Text, TextInput } from '@mantine/core'
import { useState, type ReactElement } from 'react'
import { InlineEditField } from './InlineEditField'
import { splitFolderPath, validateFolderNameBase } from '../utils/folderNameValidation'

interface FolderNameEditorProps {
  folder: string
  onRename: (newBaseName: string) => Promise<void>
}

export function FolderNameEditor({ folder, onRename }: FolderNameEditorProps): ReactElement {
  const { dirPrefix, base } = splitFolderPath(folder)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(base)

  const startEdit = (): void => {
    setDraft(base)
    setEditing(true)
  }

  const error = validateFolderNameBase(draft)

  const commit = (): void => {
    if (error) return
    setEditing(false)
    if (draft.trim() !== base) void onRename(draft.trim())
  }

  const cancel = (): void => {
    setDraft(base)
    setEditing(false)
  }

  return (
    <InlineEditField editing={editing} onStartEdit={startEdit}>
      {editing ? (
        <Group gap={2} wrap="nowrap" align="center">
          {dirPrefix && (
            <Text c="dimmed" truncate="start" style={{ flexShrink: 1, minWidth: 0 }}>
              {dirPrefix}
            </Text>
          )}
          <TextInput
            autoFocus
            variant="unstyled"
            value={draft}
            error={error}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={commit}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit()
              } else if (event.key === 'Escape') {
                cancel()
              }
            }}
            style={{ flexShrink: 0, minWidth: 80 }}
            styles={{ input: { padding: 0, height: 'auto', minHeight: 'auto' } }}
          />
        </Group>
      ) : (
        <Text truncate="end" miw={0} title={folder}>
          {folder}
        </Text>
      )}
    </InlineEditField>
  )
}
