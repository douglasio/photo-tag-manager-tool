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
import { isPhotoInFolder } from '../utils/folderTree'
import type { PhotoRecord } from '../../../shared/types'

interface PhotoLibraryContextValue {
  state: PhotoLibraryState
  photos: PhotoRecord[]
  visiblePhotos: PhotoRecord[]
  selectedPhoto: PhotoRecord | null
  addFolder: () => Promise<void>
  removeFolder: (folder: string) => Promise<void>
  cancelScan: () => Promise<void>
  selectPhoto: (path: string | null) => void
  setFolderFilter: (folder: string | null) => void
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

  // Starts a scan for one folder and resolves once that scan's scan:complete
  // event arrives, so callers can await folders sequentially rather than
  // firing them all at once.
  const startScanFor = useCallback((rootPath: string): Promise<void> => {
    return new Promise((resolve) => {
      void window.api.startScan(rootPath).then(({ scanId }) => {
        scanIdRef.current = scanId
        dispatch({ type: 'SCAN_STARTED', rootPath, scanId })

        const unsubscribe = window.api.onScanComplete((payload) => {
          if (payload.scanId !== scanId) return
          unsubscribe()
          resolve()
        })
      })
    })
  }, [])

  useEffect(() => {
    window.api.getFolders().then(async (folders) => {
      dispatch({ type: 'FOLDERS_LOADED', folders })
      for (const folder of folders) {
        await startScanFor(folder)
      }
    })
  }, [startScanFor])

  const addFolder = useCallback(async () => {
    const rootPath = await window.api.selectFolder()
    if (!rootPath) return
    await window.api.addFolder(rootPath)
    dispatch({ type: 'FOLDER_ADDED', folder: rootPath })
    void startScanFor(rootPath)
  }, [startScanFor])

  const removeFolder = useCallback(async (folder: string) => {
    await window.api.removeFolder(folder)
    dispatch({ type: 'FOLDER_REMOVED', folder })
  }, [])

  const cancelScan = useCallback(async () => {
    if (!scanIdRef.current) return
    await window.api.cancelScan(scanIdRef.current)
    dispatch({ type: 'SCAN_CANCELED' })
  }, [])

  const selectPhoto = useCallback((path: string | null) => {
    dispatch({ type: 'SELECT_PHOTO', path })
  }, [])

  const setFolderFilter = useCallback((folder: string | null) => {
    dispatch({ type: 'SET_FOLDER_FILTER', folder })
  }, [])

  const photos = useMemo(
    () =>
      Array.from(state.photosByPath.values()).sort((a, b) => a.fileName.localeCompare(b.fileName)),
    [state.photosByPath]
  )

  const visiblePhotos = useMemo(() => {
    if (!state.selectedFolder) return photos
    return photos.filter((photo) => isPhotoInFolder(photo.filePath, state.selectedFolder!))
  }, [photos, state.selectedFolder])

  const selectedPhoto = useMemo(
    () => (state.selectedPath ? (state.photosByPath.get(state.selectedPath) ?? null) : null),
    [state.selectedPath, state.photosByPath]
  )

  const value: PhotoLibraryContextValue = {
    state,
    photos,
    visiblePhotos,
    selectedPhoto,
    addFolder,
    removeFolder,
    cancelScan,
    selectPhoto,
    setFolderFilter
  }

  return <PhotoLibraryContext.Provider value={value}>{children}</PhotoLibraryContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook are colocated by design
export function usePhotoLibrary(): PhotoLibraryContextValue {
  const ctx = useContext(PhotoLibraryContext)
  if (!ctx) throw new Error('usePhotoLibrary must be used within a PhotoLibraryProvider')
  return ctx
}
