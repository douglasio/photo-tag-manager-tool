import { DateTimePicker } from '@mantine/dates'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { InlineEditField } from './InlineEditField'
import { DATE_TAKEN_FORMAT } from '../utils/metadataDisplay'

interface DateTakenEditorProps {
  value: string | null
  displayValue: string
  onSave: (isoDate: string) => Promise<void>
}

export function DateTakenEditor({
  value,
  displayValue,
  onSave
}: DateTakenEditorProps): ReactElement {
  const [editing, setEditing] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // DateTimePicker has no prop to start with its popover open (dropdownOpened
  // is purely internal useDisclosure state) — its trigger's onClick just
  // calls dropdownHandlers.toggle(), so simulating a click on mount opens it
  // the same way a real click would, saving an extra click to enter edit mode.
  useEffect(() => {
    if (editing) triggerRef.current?.click()
  }, [editing])

  const commit = (dateTimeStr: string | null): void => {
    setEditing(false)
    if (!dateTimeStr) return
    // DateTimePicker's onChange gives a "YYYY-MM-DD HH:mm:ss" string (not
    // standard ISO 8601 — no "T" separator — so `new Date(dateTimeStr)`
    // isn't reliably parsed cross-platform). Parsed manually into local Date
    // components instead, so the picked date/time round-trips exactly
    // through the ISO string sent to the main process.
    const [datePart, timePart] = dateTimeStr.split(' ')
    const [y, m, d] = datePart.split('-').map(Number)
    const [h, mi, s] = (timePart ?? '00:00:00').split(':').map(Number)
    const combined = new Date(y, m - 1, d, h, mi, s)
    void onSave(combined.toISOString())
  }

  return (
    <InlineEditField editing={editing} onStartEdit={() => setEditing(true)}>
      {editing ? (
        <DateTimePicker
          ref={triggerRef}
          autoFocus
          variant="unstyled"
          valueFormat={DATE_TAKEN_FORMAT}
          value={value ? new Date(value) : null}
          onChange={commit}
          // No onBlur-cancels-editing here (unlike the other inline editors):
          // this renders as a button that opens a portaled popover, so
          // clicking into the calendar/time inputs blurs the trigger button
          // without the user having picked anything — that would close the
          // whole editor mid-interaction. commit() (via onChange) is the
          // only thing that exits edit mode.
          onKeyDown={(event) => {
            if (event.key === 'Escape') setEditing(false)
          }}
          styles={{
            input: {
              fontSize: 'var(--mantine-font-size-sm)',
              padding: 0,
              height: 'auto',
              minHeight: 'auto'
            }
          }}
        />
      ) : (
        displayValue
      )}
    </InlineEditField>
  )
}
