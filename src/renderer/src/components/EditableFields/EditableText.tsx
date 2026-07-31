import { type MouseEvent, type ReactElement, type ReactNode, useEffect, useRef } from 'react'

import { Textarea } from '@mantine/core'

interface EditableTextProps {
  // Committed value, shown while not editing.
  value: string
  // In-progress value, shown (and mutated) while editing.
  draft: string
  editing: boolean
  onDraftChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
  placeholder?: string
  error?: ReactNode
  // Typography, applied identically in both states — the point of this
  // component. Pass the same tokens the field previously used for its
  // separate display component (Title/Text) here instead.
  fz?: string
  fw?: number
  c?: string
  ta?: 'left' | 'center' | 'right'
  // Single-line, ellipsis-truncated while not editing (for fixed-width
  // contexts like a gallery grid cell) instead of the default autosize/wrap
  // behavior — pair with a Tooltip showing the untruncated value, since the
  // truncated text itself no longer reveals the full value on its own.
  truncate?: boolean
  // When set, Shift+Enter inserts a literal newline and only plain Enter
  // commits (browser default handles the newline insertion — only the
  // commit path is intercepted). Off by default: Enter always commits,
  // for single-line-ish fields (filenames, tag names) where a newline never
  // makes sense.
  multiline?: boolean
  maxRows?: number
  maxLength?: number
  onClick?: (event: MouseEvent<HTMLTextAreaElement>) => void
}

// A single persistent Textarea that toggles `readOnly` instead of swapping
// between a display component (Title/Text) and a differently-styled input —
// the swap is what caused font-size/weight/spacing to visibly jump the
// moment editing toggled, since the two components' styles had to be
// hand-kept in sync. Using one element for both states makes that
// structurally impossible to drift.
//
// Textarea (not TextInput) so long values wrap instead of clipping/scrolling
// horizontally, matching how a Title/Text display would have wrapped —
// autosize + minRows=1 keeps it looking like a single-line field until
// content actually needs more room.
export function EditableText({
  value,
  draft,
  editing,
  onDraftChange,
  onCommit,
  onCancel,
  placeholder,
  error,
  fz,
  fw,
  c,
  ta,
  truncate,
  multiline,
  maxRows,
  maxLength,
  onClick
}: EditableTextProps): ReactElement {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Focus + select-all on entering edit mode. Can't use the `autoFocus`
  // prop for this since the element stays mounted across the editing
  // toggle — autoFocus only fires once, on initial mount.
  useEffect(() => {
    if (!editing) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [editing])

  return (
    <Textarea
      ref={inputRef}
      variant="unstyled"
      readOnly={!editing}
      autosize={!truncate}
      minRows={1}
      maxRows={maxRows}
      maxLength={maxLength}
      value={editing ? draft : value}
      placeholder={placeholder}
      error={editing ? error : undefined}
      onChange={(event) => onDraftChange(event.currentTarget.value)}
      onBlur={() => {
        if (editing) onCommit()
      }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!editing) return
        if (event.key === 'Enter' && (!multiline || !event.shiftKey)) {
          event.preventDefault()
          onCommit()
        } else if (event.key === 'Escape') {
          onCancel()
        }
      }}
      flex={1}
      miw={0}
      styles={{
        input: {
          padding: 0,
          minHeight: 'auto',
          resize: 'none',
          fontSize: fz,
          fontWeight: fw,
          color: c,
          textAlign: ta,
          // Mantine's input line-height token is sized for a full-height
          // input control (much taller than plain text) — using the same
          // line-height Mantine's own Text component defaults to instead
          // keeps this vertically aligned with any fixed Text sibling a
          // field renders next to it (e.g. a "#" prefix), since that's the
          // value that sibling is already using implicitly.
          lineHeight: 'var(--mantine-line-height)',
          cursor: editing ? 'text' : 'default',
          ...(truncate && {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            // No ellipsis while actively editing — let it scroll to the
            // caret like a normal single-line input instead of clipping
            // the text you're mid-way through typing.
            textOverflow: editing ? 'clip' : 'ellipsis'
          })
        }
      }}
    />
  )
}
