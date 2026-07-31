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

// Same single-persistent-element approach as EditableText (toggle
// interactivity instead of swapping a display component for a differently
// styled input) — DateTimePicker just isn't textarea-based, so it can't use
// EditableText itself, but it does support `readOnly`, which is enough to
// get the same effect: this always renders the same picker, showing plain
// formatted text when not editing and becoming interactive when it is.
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

  // DateTimePicker's onChange fires on every intermediate field change
  // (picking the day, then adjusting the hour, then the minute, ...), not
  // just once when the user is done — committing straight from onChange
  // used to save (and close the editor) after the very first partial pick.
  // Instead onChange only updates the local draft below; the actual commit
  // happens once the dropdown closes, via the submit button or Enter —
  // popoverProps disables the other ways a Mantine popover normally closes,
  // so those are the only two paths that reach here.
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
        // instead (which cancels without saving) — only the submit button
        // or Enter should actually commit the pick and close this.
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
            cursor: editing ? 'pointer' : 'default'
          }
        }}
      />
    </InlineEditField>
  )
}
