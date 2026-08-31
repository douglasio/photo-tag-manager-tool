import { createContext, useContext } from 'react'

import type {
  AiScanProgress,
  EmbeddingIndexProgress,
  FaceIndexProgress,
  FaceScanProgress,
  ScanPhase
} from '@shared/types'

// AI/face/photo scan progress
export interface PhotoLibraryScanProgressValue {
  aiScanProgress: AiScanProgress | null
  embeddingIndexProgress: EmbeddingIndexProgress | null
  faceScanProgress: FaceScanProgress | null
  faceIndexProgress: FaceIndexProgress | null
  // Session-only — null when no photo scan (folder add, startup sweep,
  // rescan) is in flight. See scanHandlers.ts's emitProgress for the phases.
  photoScanProgress: { phase: ScanPhase; done: number; total: number } | null
}

export const PhotoLibraryScanProgressContext = createContext<PhotoLibraryScanProgressValue | null>(
  null
)

export function useScanProgress(): PhotoLibraryScanProgressValue {
  const ctx = useContext(PhotoLibraryScanProgressContext)
  if (!ctx) throw new Error('useScanProgress must be used within a PhotoLibraryProvider')
  return ctx
}
