import { createContext, useContext } from 'react'

import type {
  AiScanProgress,
  EmbeddingIndexProgress,
  FaceIndexProgress,
  FaceScanProgress
} from '@shared/types'

// AI/face scan progress
export interface PhotoLibraryScanProgressValue {
  aiScanProgress: AiScanProgress | null
  embeddingIndexProgress: EmbeddingIndexProgress | null
  faceScanProgress: FaceScanProgress | null
  faceIndexProgress: FaceIndexProgress | null
}

export const PhotoLibraryScanProgressContext = createContext<PhotoLibraryScanProgressValue | null>(
  null
)

export function useScanProgress(): PhotoLibraryScanProgressValue {
  const ctx = useContext(PhotoLibraryScanProgressContext)
  if (!ctx) throw new Error('useScanProgress must be used within a PhotoLibraryProvider')
  return ctx
}
