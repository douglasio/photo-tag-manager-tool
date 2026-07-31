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

  // Single-line, non-truncated fields (e.g. a panel filename) size to fit
  // their actual text instead of stretching to fill the row — a full-width
  // field left the pencil icon (rendered as a flex sibling) stranded far
  // from short text. `field-sizing: content` (native, Chromium-only —
  // fine here since this only ever runs inside Electron) hands width AND
  // height sizing to the browser based on live content, so Mantine's own
  // `autosize` (a JS/ResizeObserver-driven height calculation) is turned
  // off for this case to avoid the two fighting over the element's height.
  // Truncated fields (fixed-width grid cells) and multiline fields
  // (comment/description, meant to use the full available width) keep the
  // original full-width, Mantine-autosize behavior.
  const shrinkToFit = !truncate && !multiline

  return (
    <Textarea
      ref={inputRef}
      variant="unstyled"
      readOnly={!editing}
      autosize={!!multiline}
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
      flex={shrinkToFit ? undefined : 1}
      miw={shrinkToFit ? undefined : 0}
      styles={{
        input: {
          padding: 0,
          minHeight: 'auto',
          resize: 'none',
          fontSize: fz,
          fontWeight: fw,
          color: c,
          textAlign: ta,
          lineHeight: 'var(--mantine-line-height)',
          cursor: editing ? 'text' : 'pointer',
          ...(shrinkToFit && { fieldSizing: 'content', maxWidth: '100%' }),
          ...(truncate && {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            // No ellipsis while actively editing
            textOverflow: editing ? 'clip' : 'ellipsis'
          })
        }
      }}
    />
  )
}
