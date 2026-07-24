import { useRef } from 'react'

/**
 * Wraps an inline editor's async save so the caller stays in edit mode
 * (showing the in-progress draft) until the save actually resolves, instead
 * of flipping back to display mode immediately — which would render the
 * stale old value for a moment before the parent's state catches up. Guards
 * against re-entrant commits (e.g. Enter followed by a blur while the first
 * save is still in flight). On failure, editing mode is left untouched —
 * callers' onSave is expected to already surface its own error notification,
 * so the draft isn't lost and the user can retry.
 */
export function useCommitEdit<T>(
  onSave: (value: T) => Promise<void>,
  setEditing: (editing: boolean) => void
): (value: T) => Promise<void> {
  const savingRef = useRef(false)

  return async (value: T): Promise<void> => {
    if (savingRef.current) return
    savingRef.current = true
    try {
      await onSave(value)
      setEditing(false)
    } catch {
      // stay in edit mode — see doc comment above
    } finally {
      savingRef.current = false
    }
  }
}
