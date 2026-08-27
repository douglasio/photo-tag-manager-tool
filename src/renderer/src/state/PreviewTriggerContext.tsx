import { createContext, type ReactElement, type ReactNode, useContext } from 'react'

// Deliberately not the '@hooks'/'@utils' barrels — '@state' is imported by
// files those barrels re-export, and going through them here would create a
// module cycle between the three index files.
import { useKeyHeld } from '@renderer/hooks/useKeyHeld'
import { PREVIEW_TRIGGER_KEY } from '@renderer/utils/previewTrigger'

// Defaults to false (not a must-be-inside-provider throw) — "key not held"
// is the correct answer anywhere the provider isn't mounted, e.g. isolated
// component tests.
const PreviewTriggerContext = createContext(false)

// Single app-wide "is the preview trigger key held" answer. Every gallery
// cell, dashboard widget, and duplicate row used to run its own
// useKeyHeld(PREVIEW_TRIGGER_KEY) — one keydown/keyup/blur listener trio
// each — for the exact same global state; this provider registers one.
// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider by design
export function usePreviewTriggerHeld(): boolean {
  return useContext(PreviewTriggerContext)
}

export function PreviewTriggerProvider({ children }: { children: ReactNode }): ReactElement {
  const held = useKeyHeld(PREVIEW_TRIGGER_KEY)
  return <PreviewTriggerContext.Provider value={held}>{children}</PreviewTriggerContext.Provider>
}
