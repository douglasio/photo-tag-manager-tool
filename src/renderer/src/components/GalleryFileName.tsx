import { Text, TextInput } from '@mantine/core'
import { useState, type ReactElement } from 'react'
import { InlineEditField } from './InlineEditField'
import { splitFileName, validateFileNameBase } from '../utils/fileNameValidation'

interface GalleryFileNameProps {
  fileName: string
  // Editing is controlled externally (not local state) because it can be
  // triggered remotely from the right-click context menu's "Rename" item,
  // not just by double-clicking this component itself.
  editing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
  onRename: (newBaseName: string) => Promise<void>
}

export function GalleryFileName({
  fileName,
  editing,
  onStartEdit,
  onStopEdit,
  onRename
}: GalleryFileNameProps): ReactElement {
  const { base } = splitFileName(fileName)
  const [draft, setDraft] = useState(base)

  // Reset the draft whenever edit mode is (re)entered — adjusted during
  // render rather than an effect, per React's guidance for state that needs
  // to reset when a prop changes (same pattern used in TagRenameDialog).
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

  return (
    <InlineEditField editing={editing} onStartEdit={onStartEdit} contentAlign="center">
      {editing ? (
        <TextInput
          autoFocus
          variant="unstyled"
          value={draft}
          error={!!error}
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
          styles={{
            input: {
              textAlign: 'center',
              padding: 0,
              minHeight: 'auto',
              height: 'auto',
              fontSize: 'var(--mantine-font-size-md)'
            }
          }}
        />
      ) : (
        <Text c="dimmed" truncate="end" ta="center" w="100%">
          {fileName}
        </Text>
      )}
    </InlineEditField>
  )
}
