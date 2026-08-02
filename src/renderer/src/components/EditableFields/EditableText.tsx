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
  // Typography, applied identically in both states
  fz?: string
  fw?: number
  c?: string
  ta?: 'left' | 'center' | 'right'
  // Single-line, ellipsis-truncated while not editing
  truncate?: boolean
  // When set, Shift+Enter inserts a literal newline
  multiline?: boolean
  maxRows?: number
  maxLength?: number
  onClick?: (event: MouseEvent<HTMLTextAreaElement>) => void
  // Overrides the default shrink-to-fit-width behavior
  shrinkToFit?: boolean
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
  onClick,
  shrinkToFit: shrinkToFitProp
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

  // Non-truncated fields default to sizing themselves to fit their actual
  // text instead of stretching to fill the row — a full-width field left
  // the pencil icon (rendered as a flex sibling) stranded far from short
  // text — unless `shrinkToFit` is explicitly overridden (e.g. a comment
  // box, which wants to fill its row regardless of text length) or the
  // field is truncated (fixed-width grid cell, always full-width).
  // `field-sizing: content` (native, Chromium-only — fine here since this
  // only ever runs inside Electron) hands sizing to the browser based on
  // live content, wrapping once it hits `maxWidth`, so Mantine's own
  // `autosize` (a JS/ResizeObserver-driven height calculation) is turned
  // off in this case to avoid the two fighting over the element's height.
  const shrinkToFit = !truncate && (shrinkToFitProp ?? !multiline)

  return (
    <Textarea
      ref={inputRef}
      variant="unstyled"
      readOnly={!editing}
      autosize={!!multiline && !shrinkToFit}
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
          ...(shrinkToFit && {
            fieldSizing: 'content',
            maxWidth: '100%',
            // Autosize (and its maxRows clamp) is off in this branch, so
            // replicate the row cap ourselves — field-sizing: content would
            // otherwise grow the box to fit unbounded text.
            ...(multiline &&
              maxRows && {
                maxHeight: `calc(${maxRows} * var(--mantine-line-height) * 1em)`,
                overflowY: 'auto'
              })
          }),
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
