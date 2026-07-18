import { Group, Text, TextInput, Title } from '@mantine/core'
import { useState, type ReactElement } from 'react'
import { InlineEditField } from './InlineEditField'
import { splitFileName, validateFileNameBase } from '../utils/fileNameValidation'

interface FileNameEditorProps {
  fileName: string
  onRename: (newBaseName: string) => Promise<void>
}

export function FileNameEditor({ fileName, onRename }: FileNameEditorProps): ReactElement {
  const { base, extension } = splitFileName(fileName)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(base)

  const startEdit = (): void => {
    setDraft(base)
    setEditing(true)
  }

  const error = validateFileNameBase(draft)

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
        <Group gap={2} wrap="nowrap" align="flex-start">
          <TextInput
            autoFocus
            variant="unstyled"
            value={draft}
            error={error}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit()
              } else if (event.key === 'Escape') {
                cancel()
              }
            }}
            style={{ flex: 1, minWidth: 0 }}
            styles={{
              input: {
                fontWeight: 700,
                fontSize: 'var(--mantine-h4-font-size)',
                padding: 0,
                height: 'auto',
                minHeight: 'auto'
              }
            }}
          />
          {extension && (
            <Text
              c="dimmed"
              fw={700}
              style={{ flexShrink: 0, fontSize: 'var(--mantine-h4-font-size)', paddingTop: 2 }}
            >
              {extension}
            </Text>
          )}
        </Group>
      ) : (
        <Title order={2} size="h4" style={{ wordBreak: 'break-word' }}>
          {fileName}
        </Title>
      )}
    </InlineEditField>
  )
}
