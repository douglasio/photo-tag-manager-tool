import type { PhotoRecord, ScanCompleteEvent } from '../../../shared/types'

export type ScanStatus = 'idle' | 'scanning' | 'complete' | 'canceled'

export interface PhotoLibraryState {
  rootPath: string | null
  scanId: string | null
  status: ScanStatus
  filesFound: number
  photosByPath: Map<string, PhotoRecord>
  cacheHits: number
  errors: ScanCompleteEvent['errors']
  selectedPath: string | null
}

export const initialState: PhotoLibraryState = {
  rootPath: null,
  scanId: null,
  status: 'idle',
  filesFound: 0,
  photosByPath: new Map(),
  cacheHits: 0,
  errors: [],
  selectedPath: null
}

export type PhotoLibraryAction =
  | { type: 'SCAN_STARTED'; rootPath: string; scanId: string }
  | { type: 'SCAN_PROGRESS'; filesFound: number }
  | { type: 'METADATA_BATCH'; photos: PhotoRecord[] }
  | { type: 'SCAN_COMPLETE'; result: ScanCompleteEvent }
  | { type: 'SCAN_CANCELED' }
  | { type: 'SELECT_PHOTO'; path: string | null }

export function photoLibraryReducer(
  state: PhotoLibraryState,
  action: PhotoLibraryAction
): PhotoLibraryState {
  switch (action.type) {
    case 'SCAN_STARTED':
      return {
        ...initialState,
        rootPath: action.rootPath,
        scanId: action.scanId,
        status: 'scanning'
      }
    case 'SCAN_PROGRESS':
      if (action.filesFound === state.filesFound) return state
      return { ...state, filesFound: action.filesFound }
    case 'METADATA_BATCH': {
      const photosByPath = new Map(state.photosByPath)
      for (const photo of action.photos) {
        photosByPath.set(photo.filePath, photo)
      }
      return { ...state, photosByPath }
    }
    case 'SCAN_COMPLETE':
      return {
        ...state,
        status: 'complete',
        cacheHits: action.result.cacheHits,
        errors: action.result.errors
      }
    case 'SCAN_CANCELED':
      return { ...state, status: 'canceled' }
    case 'SELECT_PHOTO':
      return { ...state, selectedPath: action.path }
    default:
      return state
  }
}
