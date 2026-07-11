import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactElement,
  type ReactNode
} from 'react'
import { initialState, photoLibraryReducer, type PhotoLibraryState } from './photoLibraryReducer'
import type { PhotoRecord } from '../../../shared/types'

interface PhotoLibraryContextValue {
  state: PhotoLibraryState
  photos: PhotoRecord[]
  selectedPhoto: PhotoRecord | null
  pickFolderAndScan: () => Promise<void>
  cancelScan: () => Promise<void>
  selectPhoto: (path: string | null) => void
}

const PhotoLibraryContext = createContext<PhotoLibraryContextValue | null>(null)

export function PhotoLibraryProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, dispatch] = useReducer(photoLibraryReducer, initialState)
  const scanIdRef = useRef<string | null>(null)

  useEffect(() => {
    const unsubscribeProgress = window.api.onScanProgress((payload) => {
      if (payload.scanId !== scanIdRef.current) return
      dispatch({ type: 'SCAN_PROGRESS', filesFound: payload.filesFound })
    })
    const unsubscribeBatch = window.api.onMetadataBatch((payload) => {
      if (payload.scanId !== scanIdRef.current) return
      dispatch({ type: 'METADATA_BATCH', photos: payload.photos })
    })
    const unsubscribeComplete = window.api.onScanComplete((payload) => {
      if (payload.scanId !== scanIdRef.current) return
      dispatch({ type: 'SCAN_COMPLETE', result: payload })
    })

    return () => {
      unsubscribeProgress()
      unsubscribeBatch()
      unsubscribeComplete()
    }
  }, [])

  const pickFolderAndScan = useCallback(async () => {
    const rootPath = await window.api.selectFolder()
    if (!rootPath) return

    const { scanId } = await window.api.startScan(rootPath)
    scanIdRef.current = scanId
    dispatch({ type: 'SCAN_STARTED', rootPath, scanId })
  }, [])

  const cancelScan = useCallback(async () => {
    if (!scanIdRef.current) return
    await window.api.cancelScan(scanIdRef.current)
    dispatch({ type: 'SCAN_CANCELED' })
  }, [])

  const selectPhoto = useCallback((path: string | null) => {
    dispatch({ type: 'SELECT_PHOTO', path })
  }, [])

  const photos = useMemo(
    () =>
      Array.from(state.photosByPath.values()).sort((a, b) => a.fileName.localeCompare(b.fileName)),
    [state.photosByPath]
  )

  const selectedPhoto = useMemo(
    () => (state.selectedPath ? (state.photosByPath.get(state.selectedPath) ?? null) : null),
    [state.selectedPath, state.photosByPath]
  )

  const value: PhotoLibraryContextValue = {
    state,
    photos,
    selectedPhoto,
    pickFolderAndScan,
    cancelScan,
    selectPhoto
  }

  return <PhotoLibraryContext.Provider value={value}>{children}</PhotoLibraryContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook are colocated by design
export function usePhotoLibrary(): PhotoLibraryContextValue {
  const ctx = useContext(PhotoLibraryContext)
  if (!ctx) throw new Error('usePhotoLibrary must be used within a PhotoLibraryProvider')
  return ctx
}
