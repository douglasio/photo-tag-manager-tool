import { type ReactElement, useEffect, useRef, useState } from 'react'

import { DateTimePicker } from '@mantine/dates'

import { useCommitEdit } from '@hooks'
import { DATE_TAKEN_FORMAT } from '@utils'

import { InlineEditField } from './InlineEditField'

interface DateTakenFieldProps {
  value: string | null
  displayValue: string
  onSave: (isoDate: string) => Promise<void>
}

// DateTimePicker's onChange gives a "YYYY-MM-DD HH:mm:ss" string (not
// standard ISO 8601 — no "T" separator — so `new Date(dateTimeStr)` isn't
// reliably parsed cross-platform). Parsed manually into local Date
// components instead, so the picked date/time round-trips exactly through
// the ISO string eventually sent to the main process.
function parsePickerValue(dateTimeStr: string): Date {
  const [datePart, timePart] = dateTimeStr.split(' ')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, mi, s] = (timePart ?? '00:00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, mi, s)
}

// Same single-persistent-element approach as EditableText
export function DateTakenField({ value, displayValue, onSave }: DateTakenFieldProps): ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Date | null>(value ? new Date(value) : null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const commitSave = useCommitEdit(onSave, setEditing)

  // DateTimePicker has no prop to start with its popover open (dropdownOpened
  // is purely internal useDisclosure state) — its trigger's onClick just
  // calls dropdownHandlers.toggle(), so simulating a click once it's no
  // longer readOnly opens it the same way a real click would, saving an
  // extra click to enter edit mode.
  useEffect(() => {
    if (editing) triggerRef.current?.click()
  }, [editing])

  const startEdit = (): void => {
    setDraft(value ? new Date(value) : null)
    setEditing(true)
  }

  // onChange only updates the local draft below; the actual commit
  // happens once the dropdown closes, via the submit button or Enter
  const commitDraft = (): void => {
    if (!draft) {
      setEditing(false)
      return
    }
    void commitSave(draft.toISOString())
  }

  return (
    <InlineEditField editing={editing} onStartEdit={startEdit}>
      <DateTimePicker
        ref={triggerRef}
        readOnly={!editing}
        variant="unstyled"
        valueFormat={DATE_TAKEN_FORMAT}
        value={editing ? draft : value ? new Date(value) : null}
        placeholder={displayValue}
        onChange={(dateTimeStr) => setDraft(dateTimeStr ? parsePickerValue(dateTimeStr) : null)}
        onDropdownClose={commitDraft}
        // Escape/outside-click are handled by our own onKeyDown below
        popoverProps={{ closeOnClickOutside: false, closeOnEscape: false }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setEditing(false)
        }}
        styles={{
          input: {
            fontSize: 'var(--mantine-font-size-sm)',
            padding: 0,
            height: 'auto',
            minHeight: 'auto',
            cursor: 'pointer'
          }
        }}
      />
    </InlineEditField>
  )
}
