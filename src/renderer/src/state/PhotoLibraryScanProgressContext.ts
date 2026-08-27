import { createContext, useContext } from 'react'

import type { AiScanProgress, FaceScanProgress } from '@shared/types'

// AI/face scan progress, split out of the Gallery bucket — progress ticks
// arrive every ~150ms for the whole duration of a scan, and keeping them in
// GalleryLibraryState made every gallery/dashboard consumer re-render on
// each tick. Only the few components that actually render progress (the
// Settings toggles, DuplicatesView, TimeWarpWidget, EnableAiFeaturesDialog)
// should subscribe here.
export interface PhotoLibraryScanProgressValue {
  aiScanProgress: AiScanProgress | null
  faceScanProgress: FaceScanProgress | null
}

export const PhotoLibraryScanProgressContext = createContext<PhotoLibraryScanProgressValue | null>(
  null
)

export function useScanProgress(): PhotoLibraryScanProgressValue {
  const ctx = useContext(PhotoLibraryScanProgressContext)
  if (!ctx) throw new Error('useScanProgress must be used within a PhotoLibraryProvider')
  return ctx
}
