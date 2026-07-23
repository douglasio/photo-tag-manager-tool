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
import { notifications } from '@mantine/notifications'
import {
  initialState,
  photoLibraryReducer,
  type GallerySortBy,
  type GallerySortOrder,
  type PhotoLibraryState
} from './photoLibraryReducer'
import { basename, isPhotoInFolder } from '../utils/folderTree'
import { toDisplayMetadata, type DisplayMetadata } from '../utils/metadataDisplay'
import type { PhotoRecord } from '../../../shared/types'

// selectedPhoto is the only place metadata is ever rendered (DetailPanel), so
// only it gets the labeled/display-formatted shape — transforming the whole
// photos array on every render would be wasted work for fields nothing reads.
export interface DisplayPhotoRecord extends Omit<PhotoRecord, 'metadata'> {
  metadata: DisplayMetadata
}

// How long to wait after the last file-watcher event before summarizing the
// batch into a single toast, so a bulk copy/delete doesn't spam a toast per file.
const WATCH_NOTIFICATION_DEBOUNCE_MS = 1500

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

interface PhotoLibraryContextValue {
  state: PhotoLibraryState
  photos: PhotoRecord[]
  visiblePhotos: PhotoRecord[]
  selectedPhoto: DisplayPhotoRecord | null
  allTags: string[]
  tagCounts: Map<string, number>
  tagCoverPhotos: Map<string, PhotoRecord>
  folderTags: string[]
  addFolder: () => Promise<void>
  removeFolder: (folder: string) => Promise<void>
  renameFolder: (folder: string, newBaseName: string) => Promise<void>
  cancelScan: () => Promise<void>
  rescanAll: () => Promise<void>
  selectPhoto: (path: string | null) => void
  toggleSelectPhoto: (path: string) => void
  selectPhotoRange: (targetPath: string) => void
  clearSelection: () => void
  addTagsToSelection: (tags: string[]) => Promise<void>
  addTagsToPhotos: (tags: string[], filePaths: string[]) => Promise<void>
  setFolderFilter: (folder: string | null) => void
  setTagFilter: (tag: string | null) => void
  setFolderTagFilter: (tag: string | null) => void
  setSort: (sortBy: GallerySortBy, sortOrder: GallerySortOrder) => void
  updateTags: (filePath: string, tags: string[]) => Promise<void>
  setTagDescription: (tag: string, description: string) => Promise<void>
  renameTag: (oldTag: string, newTag: string) => Promise<void>
  deleteTag: (tag: string) => Promise<void>
  renameFile: (filePath: string, newBaseName: string) => Promise<void>
  openTabPhotos: PhotoRecord[]
  openPhotoTab: (filePath: string) => void
  closePhotoTab: (filePath: string) => void
  setActiveTab: (tab: string) => void
}

const PhotoLibraryContext = createContext<PhotoLibraryContextValue | null>(null)

export function PhotoLibraryProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, dispatch] = useReducer(photoLibraryReducer, initialState)
  const scanIdRef = useRef<string | null>(null)
  const pendingWatchCountsRef = useRef({ added: 0, removed: 0 })
  const watchFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // TagsInput's onChange fires a fresh updateTags call per pill added, with
  // no debounce — saving several tags on the same photo in quick succession
  // would otherwise fire overlapping exiftool writes to the same file. This
  // queues writes per file path so each one waits for the previous write to
  // that same file to finish (writes to different files stay concurrent).
  const tagWriteQueueRef = useRef(new Map<string, Promise<void>>())

  const flushWatchNotification = useCallback(() => {
    watchFlushTimerRef.current = null
    const { added, removed } = pendingWatchCountsRef.current
    pendingWatchCountsRef.current = { added: 0, removed: 0 }
    if (added === 0 && removed === 0) return

    const parts: string[] = []
    if (added > 0) parts.push(`${pluralize(added, 'photo')} added`)
    if (removed > 0) parts.push(`${pluralize(removed, 'photo')} removed`)

    notifications.show({
      message: parts.join(', '),
      color: removed > 0 && added === 0 ? 'red' : 'teal'
    })
  }, [])

  const scheduleWatchNotification = useCallback(
    (kind: 'added' | 'removed') => {
      pendingWatchCountsRef.current[kind]++
      if (watchFlushTimerRef.current) clearTimeout(watchFlushTimerRef.current)
      watchFlushTimerRef.current = setTimeout(
        flushWatchNotification,
        WATCH_NOTIFICATION_DEBOUNCE_MS
      )
    },
    [flushWatchNotification]
  )

  useEffect(() => {
    return () => {
      if (watchFlushTimerRef.current) clearTimeout(watchFlushTimerRef.current)
    }
  }, [])

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
    const unsubscribeUpserted = window.api.onPhotoUpserted((payload) => {
      dispatch({ type: 'PHOTO_UPSERTED', photo: payload.photo })
      if (payload.changeType === 'add') scheduleWatchNotification('added')
    })
    const unsubscribeRemoved = window.api.onPhotoRemoved((payload) => {
      dispatch({ type: 'PHOTO_REMOVED', filePath: payload.filePath })
      scheduleWatchNotification('removed')
    })

    return () => {
      unsubscribeProgress()
      unsubscribeBatch()
      unsubscribeComplete()
      unsubscribeUpserted()
      unsubscribeRemoved()
    }
  }, [scheduleWatchNotification])

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

  useEffect(() => {
    window.api.getTagDescriptions().then((descriptions) => {
      dispatch({ type: 'TAG_DESCRIPTIONS_LOADED', descriptions })
    })
  }, [])

  useEffect(() => {
    window.api.getGallerySort().then((sort) => {
      if (sort) dispatch({ type: 'SET_SORT', sortBy: sort.sortBy, sortOrder: sort.sortOrder })
    })
  }, [])

  const addFolder = useCallback(async () => {
    const rootPath = await window.api.selectFolder()
    if (!rootPath) return
    try {
      await window.api.addFolder(rootPath)
      dispatch({ type: 'FOLDER_ADDED', folder: rootPath })
      void startScanFor(rootPath)
      notifications.show({ color: 'teal', message: `Added folder "${basename(rootPath)}"` })
    } catch (err) {
      console.error(`failed to add folder ${rootPath}`, err)
      notifications.show({ color: 'red', message: 'Failed to add folder' })
      throw err
    }
  }, [startScanFor])

  const removeFolder = useCallback(
    async (folder: string) => {
      const count = state.folderCounts.get(folder) ?? 0
      try {
        await window.api.removeFolder(folder)
        dispatch({ type: 'FOLDER_REMOVED', folder })
        notifications.show({
          color: 'red',
          message: `Removed "${basename(folder)}" — ${count} photo${count === 1 ? '' : 's'} removed`
        })
      } catch (err) {
        console.error(`failed to remove folder ${folder}`, err)
        notifications.show({ color: 'red', message: 'Failed to remove folder' })
        throw err
      }
    },
    [state.folderCounts]
  )

  const renameFolder = useCallback(async (folder: string, newBaseName: string) => {
    try {
      const newFolder = await window.api.renameFolder(folder, newBaseName)
      dispatch({ type: 'FOLDER_RENAMED', oldFolder: folder, newFolder })
      if (newFolder !== folder) {
        notifications.show({
          color: 'teal',
          message: `Renamed folder "${basename(folder)}" to "${basename(newFolder)}"`
        })
      }
    } catch (err) {
      console.error(`failed to rename folder ${folder}`, err)
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'Failed to rename folder'
      })
      throw err
    }
  }, [])

  const cancelScan = useCallback(async () => {
    if (!scanIdRef.current) return
    await window.api.cancelScan(scanIdRef.current)
    dispatch({ type: 'SCAN_CANCELED' })
  }, [])

  const rescanAll = useCallback(async () => {
    for (const folder of state.folders) {
      await startScanFor(folder)
    }
  }, [state.folders, startScanFor])

  // A plain click always replaces the whole selection with just this photo —
  // both the DetailPanel-primary pointer and the multi-select batch.
  const selectPhoto = useCallback((path: string | null) => {
    dispatch({ type: 'SELECT_PHOTO', path })
    dispatch({ type: 'SET_SELECTED_PATHS', paths: path ? [path] : [] })
  }, [])

  const toggleSelectPhoto = useCallback(
    (path: string) => {
      const next = new Set(state.selectedPaths)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      dispatch({ type: 'SET_SELECTED_PATHS', paths: Array.from(next) })
      dispatch({ type: 'SELECT_PHOTO', path })
    },
    [state.selectedPaths]
  )

  const clearSelection = useCallback(() => {
    dispatch({ type: 'SET_SELECTED_PATHS', paths: [] })
    dispatch({ type: 'SELECT_PHOTO', path: null })
  }, [])

  // General-purpose batch tag-add, shared by the multi-select context menu
  // (tags applied to state.selectedPaths) and drag-and-drop onto a tag row
  // (tags applied to whatever was actually dragged, which isn't necessarily
  // the current selection — e.g. dragging a single unselected photo).
  const addTagsToPhotos = useCallback(async (tags: string[], filePaths: string[]) => {
    if (filePaths.length === 0 || tags.length === 0) return
    try {
      const photos = await window.api.addTagsToPhotos(tags, filePaths)
      dispatch({ type: 'PHOTOS_UPSERTED', photos })
    } catch (err) {
      console.error('failed to add tags to photos', err)
      notifications.show({ color: 'red', message: 'Failed to save tags' })
      throw err
    }
  }, [])

  const addTagsToSelection = useCallback(
    (tags: string[]) => addTagsToPhotos(tags, Array.from(state.selectedPaths)),
    [addTagsToPhotos, state.selectedPaths]
  )

  const updateTags = useCallback(
    async (filePath: string, tags: string[]) => {
      const current = state.photosByPath.get(filePath)
      if (current) dispatch({ type: 'PHOTO_UPSERTED', photo: { ...current, tags } })

      // Chain onto whatever write is already pending for this same file, so
      // this one doesn't start until that one has actually finished — tags
      // is already the full desired list by the time this runs, so writing
      // it after the prior write completes (rather than concurrently with
      // it) is always correct, not just a stale-data workaround.
      const previous = tagWriteQueueRef.current.get(filePath) ?? Promise.resolve()
      const next = previous
        .catch(() => {})
        .then(async () => {
          try {
            const photo = await window.api.updateTags(filePath, tags)
            dispatch({ type: 'PHOTO_UPSERTED', photo })
          } catch (err) {
            console.error(`failed to update tags for ${filePath}`, err)
            notifications.show({ color: 'red', message: 'Failed to save tags' })
            if (current) dispatch({ type: 'PHOTO_UPSERTED', photo: current })
          }
        })
      tagWriteQueueRef.current.set(filePath, next)
      await next
    },
    [state.photosByPath]
  )

  const setFolderFilter = useCallback((folder: string | null) => {
    dispatch({ type: 'SET_FOLDER_FILTER', folder })
  }, [])

  const setTagFilter = useCallback((tag: string | null) => {
    dispatch({ type: 'SET_TAG_FILTER', tag })
  }, [])

  const setFolderTagFilter = useCallback((tag: string | null) => {
    dispatch({ type: 'SET_FOLDER_TAG_FILTER', tag })
  }, [])

  const setTagDescription = useCallback(
    async (tag: string, description: string) => {
      const previous = state.tagDescriptions.get(tag) ?? ''
      dispatch({ type: 'TAG_DESCRIPTION_UPDATED', tag, description })
      try {
        await window.api.setTagDescription(tag, description)
      } catch (err) {
        console.error(`failed to save description for tag ${tag}`, err)
        notifications.show({ color: 'red', message: 'Failed to save tag description' })
        dispatch({ type: 'TAG_DESCRIPTION_UPDATED', tag, description: previous })
      }
    },
    [state.tagDescriptions]
  )

  const renameTag = useCallback(
    async (oldTag: string, newTag: string) => {
      const filePaths = Array.from(state.photosByPath.values())
        .filter((photo) => photo.tags.includes(oldTag))
        .map((photo) => photo.filePath)

      try {
        const photos = await window.api.renameTag(oldTag, newTag, filePaths)
        dispatch({ type: 'TAG_RENAMED', oldTag, newTag, photos })
      } catch (err) {
        console.error(`failed to rename tag ${oldTag} to ${newTag}`, err)
        notifications.show({ color: 'red', message: 'Failed to rename tag' })
        throw err
      }
    },
    [state.photosByPath]
  )

  const deleteTag = useCallback(
    async (tag: string) => {
      const filePaths = Array.from(state.photosByPath.values())
        .filter((photo) => photo.tags.includes(tag))
        .map((photo) => photo.filePath)

      try {
        const photos = await window.api.deleteTag(tag, filePaths)
        dispatch({ type: 'TAG_DELETED', tag, photos })
      } catch (err) {
        console.error(`failed to delete tag ${tag}`, err)
        notifications.show({ color: 'red', message: 'Failed to delete tag' })
        throw err
      }
    },
    [state.photosByPath]
  )

  const renameFile = useCallback(
    async (filePath: string, newBaseName: string) => {
      try {
        const photo = await window.api.renamePhoto(filePath, newBaseName)
        const wasSelected = state.selectedPath === filePath
        // Dispatched before PHOTO_REMOVED so a tab open on the old path is
        // repointed to the new one, rather than PHOTO_REMOVED's own openTabs
        // pruning treating the rename as if the file had just disappeared.
        dispatch({ type: 'RENAME_PHOTO_TAB', oldPath: filePath, newPath: photo.filePath })
        dispatch({ type: 'PHOTO_REMOVED', filePath })
        dispatch({ type: 'PHOTO_UPSERTED', photo })
        if (wasSelected) dispatch({ type: 'SELECT_PHOTO', path: photo.filePath })
      } catch (err) {
        console.error(`failed to rename ${filePath}`, err)
        notifications.show({
          color: 'red',
          message: err instanceof Error ? err.message : 'Failed to rename file'
        })
        throw err
      }
    },
    [state.selectedPath]
  )

  const openPhotoTab = useCallback((filePath: string) => {
    dispatch({ type: 'OPEN_PHOTO_TAB', filePath })
  }, [])

  const closePhotoTab = useCallback((filePath: string) => {
    dispatch({ type: 'CLOSE_PHOTO_TAB', filePath })
  }, [])

  const setActiveTab = useCallback((tab: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', tab })
  }, [])

  const photos = useMemo(() => {
    const direction = state.sortOrder === 'desc' ? -1 : 1
    const result = Array.from(state.photosByPath.values())
    if (state.sortBy === 'dateTaken') {
      // Photos without EXIF date data (screenshots, stripped exports, ...)
      // always sort to the end regardless of direction, rather than
      // clustering at whichever end null happens to compare to.
      result.sort((a, b) => {
        const aTime = a.metadata.dateTaken ? Date.parse(a.metadata.dateTaken) : null
        const bTime = b.metadata.dateTaken ? Date.parse(b.metadata.dateTaken) : null
        if (aTime === null && bTime === null) return a.fileName.localeCompare(b.fileName)
        if (aTime === null) return 1
        if (bTime === null) return -1
        return direction * (aTime - bTime)
      })
    } else {
      result.sort((a, b) => direction * a.fileName.localeCompare(b.fileName))
    }
    return result
  }, [state.photosByPath, state.sortBy, state.sortOrder])

  const setSort = useCallback((sortBy: GallerySortBy, sortOrder: GallerySortOrder) => {
    dispatch({ type: 'SET_SORT', sortBy, sortOrder })
    void window.api.setGallerySort({ sortBy, sortOrder })
  }, [])

  // Folder and tag filters stack rather than being mutually exclusive, so a
  // folder-scoped tag pill (see GalleryGrid's header) can narrow within the
  // current folder instead of replacing it with a folder-agnostic tag view.
  const visiblePhotos = useMemo(() => {
    let result = photos
    if (state.selectedFolder) {
      result = result.filter((photo) => isPhotoInFolder(photo.filePath, state.selectedFolder!))
    }
    if (state.selectedTag) {
      result = result.filter((photo) => photo.tags.includes(state.selectedTag!))
    }
    return result
  }, [photos, state.selectedFolder, state.selectedTag])

  // Shift+click range-select, anchored at the current selectedPath (the
  // last-engaged photo) through targetPath, within the currently visible
  // (filtered) gallery order. Simplification vs. a strict Finder-style fixed
  // anchor: selectedPath — and so the anchor for the *next* Shift+click —
  // moves to targetPath each time, rather than staying pinned to the first
  // click of the sequence.
  const selectPhotoRange = useCallback(
    (targetPath: string) => {
      const anchorPath = state.selectedPath
      if (!anchorPath) {
        dispatch({ type: 'SET_SELECTED_PATHS', paths: [targetPath] })
        dispatch({ type: 'SELECT_PHOTO', path: targetPath })
        return
      }
      const ordered = visiblePhotos.map((photo) => photo.filePath)
      const anchorIndex = ordered.indexOf(anchorPath)
      const targetIndex = ordered.indexOf(targetPath)
      if (anchorIndex === -1 || targetIndex === -1) return
      const [start, end] =
        anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
      dispatch({ type: 'SET_SELECTED_PATHS', paths: ordered.slice(start, end + 1) })
      dispatch({ type: 'SELECT_PHOTO', path: targetPath })
    },
    [state.selectedPath, visiblePhotos]
  )

  const selectedPhoto = useMemo(() => {
    const raw = state.selectedPath ? (state.photosByPath.get(state.selectedPath) ?? null) : null
    return raw ? { ...raw, metadata: toDisplayMetadata(raw.metadata) } : null
  }, [state.selectedPath, state.photosByPath])

  // Tag covers always pick the most-recently-taken photo, independent of the
  // gallery's own sort order/direction — otherwise switching gallery sort
  // would make tag thumbnails jump around. Iterates state.photosByPath
  // directly (not the sorted `photos`) since order doesn't matter here.
  const { tagCounts, tagCoverPhotos } = useMemo(() => {
    const counts = new Map<string, number>()
    const covers = new Map<string, PhotoRecord>()
    for (const photo of state.photosByPath.values()) {
      const photoTime = photo.metadata.dateTaken ? Date.parse(photo.metadata.dateTaken) : null
      for (const tag of photo.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
        const current = covers.get(tag)
        if (!current) {
          covers.set(tag, photo)
          continue
        }
        const currentTime = current.metadata.dateTaken
          ? Date.parse(current.metadata.dateTaken)
          : null
        // Prefer the later dateTaken; if neither photo has EXIF date data,
        // fall back to filename so the pick stays deterministic instead of
        // depending on Map iteration order.
        const photoWins =
          photoTime !== null && currentTime !== null
            ? photoTime > currentTime
            : photoTime !== null
              ? true
              : currentTime === null && photo.fileName > current.fileName
        if (photoWins) covers.set(tag, photo)
      }
    }
    return { tagCounts: counts, tagCoverPhotos: covers }
  }, [state.photosByPath])

  const allTags = useMemo(() => Array.from(tagCounts.keys()).sort(), [tagCounts])

  // Tags found among photos in the currently selected folder (independent of
  // any active tag filter), used to render the folder's tag pills.
  const folderTags = useMemo(() => {
    if (!state.selectedFolder) return []
    const tags = new Set<string>()
    for (const photo of photos) {
      if (isPhotoInFolder(photo.filePath, state.selectedFolder!)) {
        for (const tag of photo.tags) tags.add(tag)
      }
    }
    return Array.from(tags).sort()
  }, [photos, state.selectedFolder])

  // Resolved in openTabs order (not sorted) so tabs stay in the order they
  // were opened rather than jumping around as the user opens more.
  const openTabPhotos = useMemo(
    () =>
      state.openTabs
        .map((path) => state.photosByPath.get(path))
        .filter((photo): photo is PhotoRecord => photo != null),
    [state.openTabs, state.photosByPath]
  )

  const value: PhotoLibraryContextValue = {
    state,
    photos,
    visiblePhotos,
    selectedPhoto,
    allTags,
    tagCounts,
    tagCoverPhotos,
    folderTags,
    addFolder,
    removeFolder,
    renameFolder,
    cancelScan,
    rescanAll,
    selectPhoto,
    toggleSelectPhoto,
    selectPhotoRange,
    clearSelection,
    addTagsToSelection,
    addTagsToPhotos,
    setFolderFilter,
    setTagFilter,
    setFolderTagFilter,
    setSort,
    updateTags,
    setTagDescription,
    renameTag,
    deleteTag,
    renameFile,
    openTabPhotos,
    openPhotoTab,
    closePhotoTab,
    setActiveTab
  }

  return <PhotoLibraryContext.Provider value={value}>{children}</PhotoLibraryContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook are colocated by design
export function usePhotoLibrary(): PhotoLibraryContextValue {
  const ctx = useContext(PhotoLibraryContext)
  if (!ctx) throw new Error('usePhotoLibrary must be used within a PhotoLibraryProvider')
  return ctx
}
