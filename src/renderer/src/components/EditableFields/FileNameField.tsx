import { type ReactElement, useState } from 'react'

import { Group, Text, Tooltip } from '@mantine/core'

import { splitFileName, validateFileNameBase } from '@utils'

import { EditableText } from './EditableText'
import { InlineEditField } from './InlineEditField'

interface FileNameFieldProps {
  fileName: string
  // Always externally controlled — DetailPanel owns local state for this
  // itself, while the gallery grid's version can also be triggered remotely
  // from a thumbnail's right-click "Rename" menu item, not just by
  // double-clicking the field.
  editing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
  onRename: (newBaseName: string) => Promise<void>
  // 'panel' — the details panel's wide column: left-aligned, wraps long
  // names, shows the extension (and the full validation message) beside the
  // input while editing.
  // 'grid' — a gallery thumbnail's cramped cell: centered, ellipsis-
  // truncates with a hover tooltip for the full name, hides the extension
  // while editing (no room for it), and only flags errors with a red border.
  variant: 'panel' | 'grid'
}

const FILENAME_FONT_SIZE = 'var(--mantine-h4-font-size)'

// The one rename-a-file field implementation, reused by the details panel
// and the gallery grid rather than each keeping its own hand-tuned copy —
// `variant` covers the handful of ways their layouts genuinely differ.
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

  // Reset the draft whenever edit mode is (re)entered — adjusted during
  // render rather than an effect, since editing can be triggered remotely
  // (the gallery's right-click "Rename" item) rather than only through
  // onStartEdit below.
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
    <Group gap={2} wrap="nowrap" align={isPanel ? 'flex-start' : 'center'}>
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
    <InlineEditField editing={editing} onStartEdit={onStartEdit}>
      {isPanel || editing ? field : <Tooltip label={fileName}>{field}</Tooltip>}
    </InlineEditField>
  )
}
