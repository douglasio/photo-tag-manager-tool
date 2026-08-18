import { type ReactElement, useState } from 'react'

import { Group, Text } from '@mantine/core'

import { DELEGATED_TOOLTIP_ATTR } from '@components'
import { splitFileName, validateFileNameBase } from '@utils'

import { EditableText } from './EditableText'
import { InlineEditField } from './InlineEditField'

interface FileNameFieldProps {
  fileName: string
  // Always externally controlled
  editing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
  onRename: (newBaseName: string) => Promise<void>
  // 'panel' — the details panel's wide column
  // 'grid' — a gallery thumbnail's cramped cell
  variant: 'panel' | 'grid'
}

const FILENAME_FONT_SIZE = 'var(--mantine-h4-font-size)'

// shared rename-a-file field implementation
export function FileNameField({
  fileName,
  editing,
  onStartEdit,
  onStopEdit,
  onRename,
  variant
}: FileNameFieldProps): ReactElement {
  const { base, extension } = splitFileName(fileName)
  const [draft, setDraft] = useState(base)

  // Reset the draft whenever edit mode is (re)entered
  const [wasEditing, setWasEditing] = useState(editing)
  if (editing !== wasEditing) {
    setWasEditing(editing)
    if (editing) setDraft(base)
  }

  const error = validateFileNameBase(draft)

  const commit = (): void => {
    if (error) return
    onStopEdit()
    if (draft.trim() !== base) void onRename(draft.trim())
  }

  const cancel = (): void => {
    setDraft(base)
    onStopEdit()
  }

  const isPanel = variant === 'panel'

  const field = (
    <Group
      gap={2}
      wrap="nowrap"
      align={isPanel ? 'flex-start' : 'center'}
      {...{ [DELEGATED_TOOLTIP_ATTR]: !isPanel && !editing ? fileName : undefined }}
    >
      <EditableText
        value={fileName}
        draft={draft}
        editing={editing}
        onDraftChange={setDraft}
        onCommit={commit}
        onCancel={cancel}
        onClick={(event) => event.stopPropagation()}
        error={isPanel ? error : !!error}
        fz={isPanel ? FILENAME_FONT_SIZE : undefined}
        fw={isPanel ? 700 : undefined}
        ta={isPanel ? undefined : 'center'}
        truncate={!isPanel}
      />
      {isPanel && editing && extension && (
        <Text c="dimmed" fw={700} fz={FILENAME_FONT_SIZE} pt={2} style={{ flexShrink: 0 }}>
          {extension}
        </Text>
      )}
    </Group>
  )

  return (
    <InlineEditField editing={editing} onStartEdit={onStartEdit} fill={!isPanel}>
      {field}
    </InlineEditField>
  )
}
