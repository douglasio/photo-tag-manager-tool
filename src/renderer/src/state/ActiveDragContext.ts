import { createContext, useContext } from 'react'

// Which of the app's four drag domains is currently in flight (see App.tsx's
// handleDragStart) — null when nothing is being dragged.
export type ActiveDragKind = 'photo' | 'tag' | 'face' | 'person' | null

// Exists specifically to keep per-row components off dnd-kit's own
// useDndContext(). That hook subscribes to dnd-kit's PublicContext, whose
// memo dependency list includes `collisions` — recomputed on every single
// pointermove during a drag. A row calling it re-renders ~100x per drag
// gesture; with hundreds of tag rows that was ~27% of frame time lost to GC
// from the resulting allocation churn.
//
// This value is a plain string|null derived from App.tsx's own activeDrag
// state, so it changes exactly twice per drag (start and end) — rows that
// only need "is a tag being dragged right now?" re-render twice instead of
// a hundred times.
export const ActiveDragContext = createContext<ActiveDragKind>(null)

export function useActiveDragKind(): ActiveDragKind {
  return useContext(ActiveDragContext)
}
