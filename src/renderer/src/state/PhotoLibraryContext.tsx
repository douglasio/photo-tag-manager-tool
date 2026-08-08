import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react'

import { notifications } from '@mantine/notifications'

import { MoveProgressToast } from '@components'
import type {
  DefaultView,
  DuplicateGroup,
  DuplicateProgress,
  GalleryViewMode,
  PhotoRecord,
  RotateDirection,
  SimilarPhoto,
  TagSuggestion
} from '@shared/types'
import { basename, isPhotoInFolder, shuffle } from '@utils'
import { type DisplayMetadata, toDisplayMetadata } from '@utils'

import {
  type GallerySortBy,
  type GallerySortOrder,
  initialState,
  MIN_COMPARE_PHOTOS,
  photoLibraryReducer,
  type PhotoLibraryState
} from './photoLibraryReducer'

// selectedPhoto is the only place metadata is ever rendered (DetailPanel), so
// only it gets the labeled/display-formatted shape — transforming the whole
// photos array on every render would be wasted work for fields nothing reads.
export interface DisplayPhotoRecord extends Omit<PhotoRecord, 'metadata'> {
  metadata: DisplayMetadata
}

// How long to wait after the last file-watcher event before summarizing the
// batch into a single toast, so a bulk copy/delete doesn't spam a toast per file.
const WATCH_NOTIFICATION_DEBOUNCE_MS = 1500

// Which arrow key drove a photo-to-photo navigation — 'right' means the
// photo being navigated to should visually enter from the right (the user
// stepped forward), 'left' means it enters from the left (stepped back).
export type NavigationDirection = 'left' | 'right'

// PhotoView's visualization mode ('none' = standard view). Lives here (not
// just as PhotoView-local state) so it can be threaded across arrow-key
// navigation below, which remounts a fresh PhotoView per photo.
export type PhotoVisualization = 'none' | 'magazine' | 'newspaper' | 'dvd'

// One entry per open tab in display order — either a single photo or a
// compare set (2-4 photos), resolved from state.openTabs/compareTabs against
// the current photosByPath (a missing photo drops out of a compare entry's
// list; the whole entry drops out if fewer than MIN_COMPARE_PHOTOS remain,
// same as a single-photo tab dropping out entirely after a delete).
export type OpenTabEntry =
  | { kind: 'photo'; id: string; photo: PhotoRecord }
  | { kind: 'compare'; id: string; photos: PhotoRecord[] }
  | { kind: 'duplicates'; id: string }

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
  untaggedCount: number
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
  removeTagsFromSelection: (tags: string[]) => Promise<void>
  removeTagsFromPhotos: (tags: string[], filePaths: string[]) => Promise<void>
  movePhotosToFolder: (filePaths: string[], destFolder: string) => Promise<void>
  setFolderFilter: (folder: string | null) => void
  setTagFilter: (tag: string | null) => void
  setFolderTagFilter: (tag: string | null) => void
  setUntaggedFilter: (active: boolean) => void
  setSort: (sortBy: GallerySortBy, sortOrder: GallerySortOrder) => void
  setDefaultView: (value: DefaultView) => void
  setShowEmptyFolders: (value: boolean) => void
  setTagsPanelGridView: (value: boolean) => void
  setGalleryViewMode: (value: GalleryViewMode) => void
  setAiTagSuggestionsEnabled: (value: boolean) => void
  ensureAiModelReady: () => Promise<void>
  suggestTags: (filePath: string, candidateLabels: string[]) => Promise<TagSuggestion[]>
  findDuplicateGroups: () => Promise<DuplicateGroup[]>
  findSimilarPhotos: (filePath: string, limit: number) => Promise<SimilarPhoto[]>
  openDuplicatesTab: () => void
  setNavbarSplitSizes: (sizes: [number, number]) => void
  setSettingsModalOpened: (value: boolean) => void
  setDetailsPanelCollapsed: (value: boolean) => void
  setGalleryAnimationsEnabled: (value: boolean) => void
  setShowFilenames: (value: boolean) => void
  setShowViewCounts: (value: boolean) => void
  setMagazineTitle: (value: string) => void
  setNewspaperTitle: (value: string) => void
  setDvdStudioName: (value: string) => void
  setExcludePatterns: (patterns: string[]) => Promise<void>
  updateTags: (filePath: string, tags: string[]) => Promise<void>
  setTagDescription: (tag: string, description: string) => Promise<void>
  renameTag: (oldTag: string, newTag: string) => Promise<void>
  deleteTag: (tag: string) => Promise<void>
  createTagGroup: (name: string, matchPattern?: string | null) => Promise<void>
  renameTagGroup: (id: string, name: string) => Promise<void>
  updateTagGroupPattern: (id: string, matchPattern: string | null) => Promise<void>
  deleteTagGroup: (id: string) => Promise<void>
  assignTagToGroup: (tag: string, groupId: string | null) => Promise<void>
  renameFile: (filePath: string, newBaseName: string) => Promise<void>
  updateDateTaken: (filePath: string, isoDate: string) => Promise<void>
  updateComment: (filePath: string, comment: string) => Promise<void>
  rotatePhoto: (filePath: string, direction: RotateDirection) => Promise<void>
  incrementViewCount: (filePath: string) => Promise<void>
  openTabEntries: OpenTabEntry[]
  openPhotoTab: (filePath: string) => void
  openCompareTab: (paths: string[]) => void
  removeFromCompareTab: (tabId: string, filePath: string) => void
  closePhotoTab: (filePath: string) => void
  closeAllTabs: () => void
  setActiveTab: (tab: string) => void
  reorderPhotoTabs: (openTabs: string[]) => void
  navigateToPhoto: (
    fromPath: string,
    toPath: string,
    direction: NavigationDirection,
    visualization: PhotoVisualization
  ) => void
  // One-shot lookup for PhotoView's entrance animation: which arrow key (if
  // any) navigated to this specific photo, so it can slide in from the
  // matching side. Consuming it removes it — a photo opened normally (double
  // click, or reopening one you arrow-navigated away from earlier) must not
  // replay a stale direction.
  consumeNavDirection: (filePath: string) => NavigationDirection | null
  // Same one-shot pattern as consumeNavDirection, carrying the visualization
  // mode (e.g. magazine cover) across arrow-key navigation's remount so it
  // stays active as the user steps through photos.
  consumeVisualization: (filePath: string) => PhotoVisualization | null
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
    const unsubscribeFolderAdded = window.api.onFolderAdded((payload) => {
      dispatch({ type: 'WATCH_FOLDER_ADDED', folderPath: payload.folderPath })
    })
    const unsubscribeFolderRemoved = window.api.onFolderRemoved((payload) => {
      dispatch({ type: 'WATCH_FOLDER_REMOVED', folderPath: payload.folderPath })
    })

    return () => {
      unsubscribeProgress()
      unsubscribeBatch()
      unsubscribeComplete()
      unsubscribeUpserted()
      unsubscribeRemoved()
      unsubscribeFolderAdded()
      unsubscribeFolderRemoved()
    }
  }, [scheduleWatchNotification])

  // Starts a scan for one folder and resolves once that scan's scan:complete
  // event arrives.
  const startScanFor = useCallback((rootPath: string): Promise<void> => {
    return new Promise((resolve) => {
      void window.api.startScan(rootPath).then(({ scanId }) => {
        scanIdRef.current = scanId
        dispatch({ type: 'SCAN_STARTED', scanId })

        const unsubscribe = window.api.onScanComplete((payload) => {
          if (payload.scanId !== scanId) return
          unsubscribe()
          resolve()
        })
      })
    })
  }, [])

  // Same as startScanFor, but combines every given root into one scan (one
  // scanId, one shared metadata/thumbnail concurrency pool) instead of
  // awaiting each folder's scan sequentially — used for the startup sweep
  // and "rescan all," where sequential awaiting made total load time the
  // sum of every folder's scan time.
  const startScanForAll = useCallback((rootPaths: string[]): Promise<void> => {
    if (rootPaths.length === 0) return Promise.resolve()
    return new Promise((resolve) => {
      void window.api.startScanAll(rootPaths).then(({ scanId }) => {
        scanIdRef.current = scanId
        dispatch({ type: 'SCAN_STARTED', scanId })

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
      await startScanForAll(folders)
      dispatch({ type: 'INITIAL_LOAD_COMPLETE' })
    })
  }, [startScanForAll])

  useEffect(() => {
    window.api.getTagDescriptions().then((descriptions) => {
      dispatch({ type: 'TAG_DESCRIPTIONS_LOADED', descriptions })
    })
  }, [])

  const loadTagGroupsData = useCallback(() => {
    return window.api.getTagGroupsData().then(({ groups, assignments }) => {
      dispatch({ type: 'TAG_GROUPS_DATA_LOADED', groups, assignments })
    })
  }, [])

  useEffect(() => {
    void loadTagGroupsData()
  }, [loadTagGroupsData])

  useEffect(() => {
    window.api.getGallerySort().then((sort) => {
      if (sort) dispatch({ type: 'SET_SORT', sortBy: sort.sortBy, sortOrder: sort.sortOrder })
    })
  }, [])

  useEffect(() => {
    window.api.getDefaultView().then((value) => {
      dispatch({ type: 'SET_DEFAULT_VIEW', value })
      dispatch({ type: 'SET_ACTIVE_TAB', tab: value })
    })
  }, [])

  useEffect(() => {
    window.api.getShowEmptyFolders().then((value) => {
      dispatch({ type: 'SET_SHOW_EMPTY_FOLDERS', value })
    })
  }, [])

  useEffect(() => {
    window.api.getTagsPanelGridView().then((value) => {
      dispatch({ type: 'SET_TAGS_PANEL_GRID_VIEW', value })
    })
  }, [])

  useEffect(() => {
    window.api.getGalleryViewMode().then((value) => {
      dispatch({ type: 'SET_GALLERY_VIEW_MODE', value })
    })
  }, [])

  useEffect(() => {
    window.api.getAiTagSuggestionsEnabled().then((value) => {
      dispatch({ type: 'SET_AI_TAG_SUGGESTIONS_ENABLED', value })
    })
  }, [])

  useEffect(() => {
    window.api.getExcludePatterns().then((patterns) => {
      dispatch({ type: 'SET_EXCLUDE_PATTERNS', patterns })
    })
  }, [])

  useEffect(() => {
    window.api.getDetailsPanelCollapsed().then((value) => {
      dispatch({ type: 'SET_DETAILS_PANEL_COLLAPSED', value })
    })
  }, [])

  useEffect(() => {
    window.api.getNavbarSplitSizes().then((sizes) => {
      if (sizes) dispatch({ type: 'SET_NAVBAR_SPLIT_SIZES', sizes })
    })
  }, [])

  useEffect(() => {
    window.api.getGalleryAnimationsEnabled().then((value) => {
      dispatch({ type: 'SET_GALLERY_ANIMATIONS_ENABLED', value })
    })
  }, [])

  useEffect(() => {
    window.api.getShowFilenames().then((value) => {
      dispatch({ type: 'SET_SHOW_FILENAMES', value })
    })
  }, [])

  useEffect(() => {
    window.api.getShowViewCounts().then((value) => {
      dispatch({ type: 'SET_SHOW_VIEW_COUNTS', value })
    })
  }, [])

  useEffect(() => {
    window.api.getMagazineTitle().then((value) => {
      dispatch({ type: 'SET_MAGAZINE_TITLE', value })
    })
  }, [])

  useEffect(() => {
    window.api.getNewspaperTitle().then((value) => {
      dispatch({ type: 'SET_NEWSPAPER_TITLE', value })
    })
  }, [])

  useEffect(() => {
    window.api.getDvdStudioName().then((value) => {
      dispatch({ type: 'SET_DVD_STUDIO_NAME', value })
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
    await startScanForAll(state.folders)
  }, [state.folders, startScanForAll])

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
  const addTagsToPhotos = useCallback(
    async (tags: string[], filePaths: string[]) => {
      if (filePaths.length === 0 || tags.length === 0) return
      try {
        const photos = await window.api.addTagsToPhotos(tags, filePaths)
        dispatch({ type: 'PHOTOS_UPSERTED', photos })
        dispatch({ type: 'TAGS_ASSIGNED', tags })
        void loadTagGroupsData()
      } catch (err) {
        console.error('failed to add tags to photos', err)
        notifications.show({ color: 'red', message: 'Failed to save tags' })
        throw err
      }
    },
    [loadTagGroupsData]
  )

  const addTagsToSelection = useCallback(
    (tags: string[]) => addTagsToPhotos(tags, Array.from(state.selectedPaths)),
    [addTagsToPhotos, state.selectedPaths]
  )

  // Mirrors addTagsToPhotos, but for removal — unlike deleteTag, scoped to
  // just filePaths and never touches the tag's own metadata (others may still carry it).
  const removeTagsFromPhotos = useCallback(async (tags: string[], filePaths: string[]) => {
    if (filePaths.length === 0 || tags.length === 0) return
    try {
      const photos = await window.api.removeTagsFromPhotos(tags, filePaths)
      dispatch({ type: 'PHOTOS_UPSERTED', photos })
    } catch (err) {
      console.error('failed to remove tags from photos', err)
      notifications.show({ color: 'red', message: 'Failed to save tags' })
      throw err
    }
  }, [])

  const removeTagsFromSelection = useCallback(
    (tags: string[]) => removeTagsFromPhotos(tags, Array.from(state.selectedPaths)),
    [removeTagsFromPhotos, state.selectedPaths]
  )

  // Drag-and-drop onto a folder row moves the dragged photo(s) into it. Mirrors
  // renameFile's dispatch sequence (a cross-folder move is structurally the
  // same as a rename — same DB row, new full path) for each moved photo, plus
  // re-pointing selectedPath/selectedPaths from old to new paths since a move
  // (unlike a same-folder rename) can be triggered on a multi-selection.
  const movePhotosToFolder = useCallback(
    async (filePaths: string[], destFolder: string) => {
      if (filePaths.length === 0) return

      const notificationId = crypto.randomUUID()
      notifications.show({
        id: notificationId,
        color: 'indigo',
        autoClose: false,
        withCloseButton: false,
        message: <MoveProgressToast completed={0} total={filePaths.length} />
      })
      const unsubscribe = window.api.onMoveProgress((progress) => {
        notifications.update({
          id: notificationId,
          message: <MoveProgressToast completed={progress.completed} total={progress.total} />
        })
      })

      try {
        const { moved, skipped } = await window.api.movePhotosToFolder(filePaths, destFolder)
        const pathMap = new Map(moved.map(({ oldPath, photo }) => [oldPath, photo.filePath]))

        for (const { oldPath, photo } of moved) {
          dispatch({ type: 'RENAME_PHOTO_TAB', oldPath, newPath: photo.filePath })
          dispatch({ type: 'PHOTO_REMOVED', filePath: oldPath })
          dispatch({ type: 'PHOTO_UPSERTED', photo })
        }
        if (state.selectedPath && pathMap.has(state.selectedPath)) {
          dispatch({ type: 'SELECT_PHOTO', path: pathMap.get(state.selectedPath)! })
        }
        if (state.selectedPaths.size > 0 && moved.some(({ oldPath }) => pathMap.has(oldPath))) {
          dispatch({
            type: 'SET_SELECTED_PATHS',
            paths: Array.from(state.selectedPaths, (path) => pathMap.get(path) ?? path)
          })
        }

        notifications.update({
          id: notificationId,
          color: moved.length > 0 ? 'teal' : 'yellow',
          autoClose: 4000,
          withCloseButton: true,
          message:
            moved.length > 0
              ? `Moved ${pluralize(moved.length, 'photo')} to "${basename(destFolder)}"${
                  skipped > 0 ? ` (${pluralize(skipped, 'photo')} already there)` : ''
                }`
              : `${pluralize(skipped, 'photo')} already in "${basename(destFolder)}"`
        })
      } catch (err) {
        console.error(`failed to move photos to ${destFolder}`, err)
        notifications.update({
          id: notificationId,
          color: 'red',
          autoClose: 4000,
          withCloseButton: true,
          message: 'Failed to move photos'
        })
      } finally {
        unsubscribe()
      }
    },
    [state.selectedPath, state.selectedPaths]
  )

  const updateTags = useCallback(
    async (filePath: string, tags: string[]) => {
      const current = state.photosByPath.get(filePath)
      if (current) dispatch({ type: 'PHOTO_UPSERTED', photo: { ...current, tags } })

      const newlyAdded = tags.filter((tag) => !current?.tags.includes(tag))
      if (newlyAdded.length > 0) dispatch({ type: 'TAGS_ASSIGNED', tags: newlyAdded })

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
            // Removing a tag here can drop it to zero photos elsewhere
            // (main already pruned its group assignment server-side) —
            // refetch so this session's state doesn't drift from that.
            void loadTagGroupsData()
          } catch (err) {
            console.error(`failed to update tags for ${filePath}`, err)
            notifications.show({ color: 'red', message: 'Failed to save tags' })
            if (current) dispatch({ type: 'PHOTO_UPSERTED', photo: current })
          }
        })
      tagWriteQueueRef.current.set(filePath, next)
      await next
    },
    [state.photosByPath, loadTagGroupsData]
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

  const setUntaggedFilter = useCallback((active: boolean) => {
    dispatch({ type: 'SET_UNTAGGED_FILTER', active })
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
        void loadTagGroupsData()
      } catch (err) {
        console.error(`failed to rename tag ${oldTag} to ${newTag}`, err)
        notifications.show({ color: 'red', message: 'Failed to rename tag' })
        throw err
      }
    },
    [state.photosByPath, loadTagGroupsData]
  )

  const deleteTag = useCallback(
    async (tag: string) => {
      const filePaths = Array.from(state.photosByPath.values())
        .filter((photo) => photo.tags.includes(tag))
        .map((photo) => photo.filePath)

      try {
        const photos = await window.api.deleteTag(tag, filePaths)
        dispatch({ type: 'TAG_DELETED', tag, photos })
        void loadTagGroupsData()
      } catch (err) {
        console.error(`failed to delete tag ${tag}`, err)
        notifications.show({ color: 'red', message: 'Failed to delete tag' })
        throw err
      }
    },
    [state.photosByPath, loadTagGroupsData]
  )

  // Group id/position are assigned server-side (createTagGroup), so this
  // waits for the response rather than dispatching optimistically like the
  // other three below — there's nothing sensible to render before that.
  const createTagGroup = useCallback(
    async (name: string, matchPattern: string | null = null) => {
      const trimmed = name.trim()
      if (!trimmed) return
      try {
        const group = await window.api.createTagGroup(trimmed, matchPattern)
        dispatch({ type: 'TAG_GROUP_CREATED', group })
        // A rule set at creation time sweeps in matching tags server-side —
        // refetch to pick up whatever it just assigned.
        if (group.matchPattern) void loadTagGroupsData()
      } catch (err) {
        console.error(`failed to create tag group ${trimmed}`, err)
        notifications.show({ color: 'red', message: 'Failed to create tag group' })
        throw err
      }
    },
    [loadTagGroupsData]
  )

  const renameTagGroup = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    dispatch({ type: 'TAG_GROUP_RENAMED', id, name: trimmed })
    void window.api.renameTagGroup(id, trimmed)
  }, [])

  const updateTagGroupPattern = useCallback(
    async (id: string, matchPattern: string | null) => {
      const trimmed = matchPattern?.trim() || null
      dispatch({ type: 'TAG_GROUP_MATCH_PATTERN_UPDATED', id, matchPattern: trimmed })
      await window.api.setTagGroupMatchPattern(id, trimmed)
      // The pattern change sweeps tag assignments server-side — refetch to
      // reflect whatever it just added/removed from this (or any) group.
      void loadTagGroupsData()
    },
    [loadTagGroupsData]
  )

  const deleteTagGroup = useCallback(async (id: string) => {
    dispatch({ type: 'TAG_GROUP_DELETED', id })
    void window.api.deleteTagGroup(id)
  }, [])

  const assignTagToGroup = useCallback(async (tag: string, groupId: string | null) => {
    dispatch({ type: 'TAG_GROUP_ASSIGNMENT_CHANGED', tag, groupId })
    void window.api.setTagGroupAssignment(tag, groupId)
  }, [])

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

  const updateDateTaken = useCallback(async (filePath: string, isoDate: string) => {
    try {
      const photo = await window.api.updateDateTaken(filePath, isoDate)
      dispatch({ type: 'PHOTO_UPSERTED', photo })
    } catch (err) {
      console.error(`failed to update date taken for ${filePath}`, err)
      notifications.show({ color: 'red', message: 'Failed to update date taken' })
      throw err
    }
  }, [])

  const updateComment = useCallback(async (filePath: string, comment: string) => {
    try {
      const photo = await window.api.updateComment(filePath, comment)
      dispatch({ type: 'PHOTO_UPSERTED', photo })
    } catch (err) {
      console.error(`failed to update comment for ${filePath}`, err)
      notifications.show({ color: 'red', message: 'Failed to update comment' })
      throw err
    }
  }, [])

  // Passive/background tracking (mount, hover-preview) — errors are logged,
  // not surfaced as a notification toast, since a failed view-count bump
  // shouldn't interrupt the user for something they didn't explicitly do.
  const incrementViewCount = useCallback(async (filePath: string) => {
    try {
      const photo = await window.api.incrementPhotoView(filePath)
      if (photo) dispatch({ type: 'PHOTO_UPSERTED', photo })
    } catch (err) {
      console.error(`failed to increment view count for ${filePath}`, err)
    }
  }, [])

  const rotatePhoto = useCallback(async (filePath: string, direction: RotateDirection) => {
    try {
      const photo = await window.api.rotatePhoto(filePath, direction)
      dispatch({ type: 'PHOTO_UPSERTED', photo })
    } catch (err) {
      console.error(`failed to rotate ${filePath}`, err)
      notifications.show({ color: 'red', message: 'Failed to rotate photo' })
      throw err
    }
  }, [])

  const openPhotoTab = useCallback((filePath: string) => {
    dispatch({ type: 'OPEN_PHOTO_TAB', filePath })
  }, [])

  const openCompareTab = useCallback((paths: string[]) => {
    dispatch({ type: 'OPEN_COMPARE_TAB', paths })
  }, [])

  const removeFromCompareTab = useCallback((tabId: string, filePath: string) => {
    dispatch({ type: 'REMOVE_FROM_COMPARE_TAB', tabId, filePath })
  }, [])

  const closePhotoTab = useCallback((filePath: string) => {
    dispatch({ type: 'CLOSE_PHOTO_TAB', filePath })
  }, [])

  const closeAllTabs = useCallback(() => {
    dispatch({ type: 'CLOSE_ALL_TABS' })
  }, [])

  const setActiveTab = useCallback((tab: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', tab })
  }, [])

  const reorderPhotoTabs = useCallback((openTabs: string[]) => {
    dispatch({ type: 'REORDER_PHOTO_TABS', openTabs })
  }, [])

  // Plain refs (not reducer state) since these are one-shot side channels
  // read exactly once by the PhotoView instance that mounts for `toPath` —
  // they don't need to trigger a re-render of their own, and reducer state
  // would otherwise need a separate "clear it" action to avoid the
  // stale-direction problem described on consumeNavDirection below.
  const navDirectionsRef = useRef(new Map<string, NavigationDirection>())
  const visualizationsRef = useRef(new Map<string, PhotoVisualization>())

  // Swaps which photo a tab points to in place (same slot, same tab-list
  // position) — e.g. left/right-arrow stepping to the next/previous photo
  // in gallery order while viewing one. RENAME_PHOTO_TAB's own transform
  // (replace oldPath with newPath everywhere in openTabs/activeTab) is
  // exactly what this needs too, so it's reused rather than duplicated.
  const navigateToPhoto = useCallback(
    (
      fromPath: string,
      toPath: string,
      direction: NavigationDirection,
      visualization: PhotoVisualization
    ) => {
      navDirectionsRef.current.set(toPath, direction)
      visualizationsRef.current.set(toPath, visualization)
      dispatch({ type: 'RENAME_PHOTO_TAB', oldPath: fromPath, newPath: toPath })
    },
    []
  )

  const consumeNavDirection = useCallback((filePath: string): NavigationDirection | null => {
    const direction = navDirectionsRef.current.get(filePath) ?? null
    navDirectionsRef.current.delete(filePath)
    return direction
  }, [])

  const consumeVisualization = useCallback((filePath: string): PhotoVisualization | null => {
    const visualization = visualizationsRef.current.get(filePath) ?? null
    visualizationsRef.current.delete(filePath)
    return visualization
  }, [])

  // Locked in when Random is (re)selected or the photo count changes while
  // already in Random mode — adjusted during render, per this codebase's
  // convention, rather than an effect. Recomputing the shuffle on every
  // render (e.g. via state.photosByPath identity, which changes on any
  // photo update) would reshuffle the whole grid on incidental interactions
  // like a view-count bump, same as the existing viewCount-sort issue but
  // worse since it'd affect every field, not just the one being sorted on.
  // randomOrderSize resets to null on leaving Random so the next time it's
  // selected always starts from a fresh shuffle, matching a "shuffle" button.
  const [randomOrder, setRandomOrder] = useState<string[]>([])
  const [randomOrderSize, setRandomOrderSize] = useState<number | null>(null)
  if (state.sortBy === 'random') {
    if (state.photosByPath.size !== randomOrderSize) {
      setRandomOrderSize(state.photosByPath.size)
      setRandomOrder(shuffle(Array.from(state.photosByPath.keys())))
    }
  } else if (randomOrderSize !== null) {
    setRandomOrderSize(null)
  }

  const photos = useMemo(() => {
    const direction = state.sortOrder === 'desc' ? -1 : 1
    const result = Array.from(state.photosByPath.values())
    if (state.sortBy === 'random') {
      return randomOrder
        .map((filePath) => state.photosByPath.get(filePath))
        .filter((photo): photo is PhotoRecord => photo != null)
    }
    if (state.sortBy === 'dateTaken') {
      // Missing or unparseable dates (some tools write a "0000:00:00
      // 00:00:00" sentinel, which Date.parse turns into NaN) sort to the end.
      result.sort((a, b) => {
        const aParsed = a.metadata.dateTaken ? Date.parse(a.metadata.dateTaken) : NaN
        const bParsed = b.metadata.dateTaken ? Date.parse(b.metadata.dateTaken) : NaN
        const aTime = Number.isNaN(aParsed) ? null : aParsed
        const bTime = Number.isNaN(bParsed) ? null : bParsed
        if (aTime === null && bTime === null) return a.fileName.localeCompare(b.fileName)
        if (aTime === null) return 1
        if (bTime === null) return -1
        return direction * (aTime - bTime)
      })
    } else if (state.sortBy === 'viewCount') {
      // Ties (most commonly 0 views, before anything's been opened) fall
      // back to filename so the order stays stable rather than shuffling.
      result.sort((a, b) => {
        if (a.viewCount === b.viewCount) return a.fileName.localeCompare(b.fileName)
        return direction * (a.viewCount - b.viewCount)
      })
    } else {
      result.sort((a, b) => direction * a.fileName.localeCompare(b.fileName))
    }
    return result
  }, [state.photosByPath, state.sortBy, state.sortOrder, randomOrder])

  const setSort = useCallback((sortBy: GallerySortBy, sortOrder: GallerySortOrder) => {
    dispatch({ type: 'SET_SORT', sortBy, sortOrder })
    void window.api.setGallerySort({ sortBy, sortOrder })
  }, [])

  const setDefaultView = useCallback((value: DefaultView) => {
    dispatch({ type: 'SET_DEFAULT_VIEW', value })
    void window.api.setDefaultView(value)
  }, [])

  const setShowEmptyFolders = useCallback((value: boolean) => {
    dispatch({ type: 'SET_SHOW_EMPTY_FOLDERS', value })
    void window.api.setShowEmptyFolders(value)
  }, [])

  const setTagsPanelGridView = useCallback((value: boolean) => {
    dispatch({ type: 'SET_TAGS_PANEL_GRID_VIEW', value })
    void window.api.setTagsPanelGridView(value)
  }, [])

  const setGalleryViewMode = useCallback((value: GalleryViewMode) => {
    dispatch({ type: 'SET_GALLERY_VIEW_MODE', value })
    void window.api.setGalleryViewMode(value)
  }, [])

  const setAiTagSuggestionsEnabled = useCallback((value: boolean) => {
    dispatch({ type: 'SET_AI_TAG_SUGGESTIONS_ENABLED', value })
    void window.api.setAiTagSuggestionsEnabled(value)
  }, [])

  // Downloads (first time only) and loads the CLIP model — called by the
  // Settings toggle before it persists "enabled", streaming progress via
  // the same subscribe/unsubscribe-around-the-call pattern as movePhotosToFolder.
  const ensureAiModelReady = useCallback(async () => {
    dispatch({ type: 'SET_AI_MODEL_DOWNLOAD_PROGRESS', progress: 0 })
    const unsubscribe = window.api.onAiDownloadProgress((progress) => {
      dispatch({ type: 'SET_AI_MODEL_DOWNLOAD_PROGRESS', progress })
    })
    try {
      await window.api.ensureAiModelReady()
    } finally {
      unsubscribe()
      dispatch({ type: 'SET_AI_MODEL_DOWNLOAD_PROGRESS', progress: null })
    }
  }, [])

  const suggestTags = useCallback(
    (filePath: string, candidateLabels: string[]) =>
      window.api.suggestTags(filePath, candidateLabels),
    []
  )

  // Same subscribe/unsubscribe-around-the-call progress pattern as
  // ensureAiModelReady above, just with a two-phase {phase, done, total}
  // shape instead of a single percentage.
  const findDuplicateGroups = useCallback(async () => {
    dispatch({
      type: 'SET_DUPLICATE_SCAN_PROGRESS',
      progress: { phase: 'embedding', done: 0, total: 0 }
    })
    const unsubscribe = window.api.onDuplicateProgress((progress: DuplicateProgress) => {
      dispatch({ type: 'SET_DUPLICATE_SCAN_PROGRESS', progress })
    })
    try {
      return await window.api.findDuplicateGroups()
    } finally {
      unsubscribe()
      dispatch({ type: 'SET_DUPLICATE_SCAN_PROGRESS', progress: null })
    }
  }, [])

  const findSimilarPhotos = useCallback(
    (filePath: string, limit: number) => window.api.findSimilarPhotos(filePath, limit),
    []
  )

  const openDuplicatesTab = useCallback(() => {
    dispatch({ type: 'OPEN_DUPLICATES_TAB' })
  }, [])

  const setNavbarSplitSizes = useCallback((sizes: [number, number]) => {
    dispatch({ type: 'SET_NAVBAR_SPLIT_SIZES', sizes })
    void window.api.setNavbarSplitSizes(sizes)
  }, [])

  // Session-only UI state — no window.api persistence, unlike the settings
  // toggles above (a modal should always start closed on launch).
  const setSettingsModalOpened = useCallback((value: boolean) => {
    dispatch({ type: 'SET_SETTINGS_MODAL_OPENED', value })
  }, [])

  const setDetailsPanelCollapsed = useCallback((value: boolean) => {
    dispatch({ type: 'SET_DETAILS_PANEL_COLLAPSED', value })
    void window.api.setDetailsPanelCollapsed(value)
  }, [])

  const setGalleryAnimationsEnabled = useCallback((value: boolean) => {
    dispatch({ type: 'SET_GALLERY_ANIMATIONS_ENABLED', value })
    void window.api.setGalleryAnimationsEnabled(value)
  }, [])

  const setShowFilenames = useCallback((value: boolean) => {
    dispatch({ type: 'SET_SHOW_FILENAMES', value })
    void window.api.setShowFilenames(value)
  }, [])

  const setShowViewCounts = useCallback((value: boolean) => {
    dispatch({ type: 'SET_SHOW_VIEW_COUNTS', value })
    void window.api.setShowViewCounts(value)
  }, [])

  const setMagazineTitle = useCallback((value: string) => {
    dispatch({ type: 'SET_MAGAZINE_TITLE', value })
    void window.api.setMagazineTitle(value)
  }, [])

  const setNewspaperTitle = useCallback((value: string) => {
    dispatch({ type: 'SET_NEWSPAPER_TITLE', value })
    void window.api.setNewspaperTitle(value)
  }, [])

  const setDvdStudioName = useCallback((value: string) => {
    dispatch({ type: 'SET_DVD_STUDIO_NAME', value })
    void window.api.setDvdStudioName(value)
  }, [])

  // Persists the patterns, then rescans every folder so the library itself
  // (not just future filesystem events) reflects the change — files/folders
  // newly matched get pruned out, anything un-excluded gets picked back up.
  const setExcludePatterns = useCallback(
    async (patterns: string[]) => {
      dispatch({ type: 'SET_EXCLUDE_PATTERNS', patterns })
      await window.api.setExcludePatterns(patterns)
      await rescanAll()
    },
    [rescanAll]
  )

  // Folder and tag filters stack rather than being mutually exclusive, so a
  // folder-scoped tag pill (see GalleryGrid's header) can narrow within the
  // current folder instead of replacing it with a folder-agnostic tag view.
  const visiblePhotos = useMemo(() => {
    if (state.untaggedFilterActive) {
      return photos.filter((photo) => photo.tags.length === 0)
    }
    let result = photos
    if (state.selectedFolder) {
      result = result.filter((photo) => isPhotoInFolder(photo.filePath, state.selectedFolder!))
    }
    if (state.selectedTag) {
      result = result.filter((photo) => photo.tags.includes(state.selectedTag!))
    }
    return result
  }, [photos, state.selectedFolder, state.selectedTag, state.untaggedFilterActive])

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

  // While a photo-view tab is active, DetailPanel should track that tab's
  // photo (not the gallery's own selection cursor, which keeps whatever it
  // last was and can point somewhere else entirely) — the active tab's path
  // wins whenever it isn't the 'gallery' tab itself.
  const selectedPhoto = useMemo(() => {
    const path = state.activeTab !== 'gallery' ? state.activeTab : state.selectedPath
    const raw = path ? (state.photosByPath.get(path) ?? null) : null
    return raw ? { ...raw, metadata: toDisplayMetadata(raw.metadata) } : null
  }, [state.selectedPath, state.activeTab, state.photosByPath])

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

  const untaggedCount = useMemo(() => {
    let count = 0
    for (const photo of state.photosByPath.values()) {
      if (photo.tags.length === 0) count++
    }
    return count
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
  const openTabEntries = useMemo(
    () =>
      state.openTabs
        .map((id): OpenTabEntry | null => {
          if (id === 'duplicates') return { kind: 'duplicates', id }
          const paths = state.compareTabs.get(id)
          if (paths) {
            const photos = paths
              .map((path) => state.photosByPath.get(path))
              .filter((photo): photo is PhotoRecord => photo != null)
            return photos.length >= MIN_COMPARE_PHOTOS ? { kind: 'compare', id, photos } : null
          }
          const photo = state.photosByPath.get(id)
          return photo ? { kind: 'photo', id, photo } : null
        })
        .filter((entry): entry is OpenTabEntry => entry != null),
    [state.openTabs, state.compareTabs, state.photosByPath]
  )

  const value: PhotoLibraryContextValue = {
    state,
    photos,
    visiblePhotos,
    selectedPhoto,
    allTags,
    tagCounts,
    tagCoverPhotos,
    untaggedCount,
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
    removeTagsFromSelection,
    removeTagsFromPhotos,
    movePhotosToFolder,
    setFolderFilter,
    setTagFilter,
    setFolderTagFilter,
    setUntaggedFilter,
    setSort,
    setDefaultView,
    setShowEmptyFolders,
    setTagsPanelGridView,
    setGalleryViewMode,
    setAiTagSuggestionsEnabled,
    ensureAiModelReady,
    suggestTags,
    findDuplicateGroups,
    findSimilarPhotos,
    openDuplicatesTab,
    setNavbarSplitSizes,
    setSettingsModalOpened,
    setDetailsPanelCollapsed,
    setGalleryAnimationsEnabled,
    setShowFilenames,
    setShowViewCounts,
    setMagazineTitle,
    setNewspaperTitle,
    setDvdStudioName,
    setExcludePatterns,
    updateTags,
    setTagDescription,
    renameTag,
    deleteTag,
    createTagGroup,
    renameTagGroup,
    updateTagGroupPattern,
    deleteTagGroup,
    assignTagToGroup,
    renameFile,
    updateDateTaken,
    updateComment,
    rotatePhoto,
    incrementViewCount,
    openTabEntries,
    openPhotoTab,
    openCompareTab,
    removeFromCompareTab,
    closePhotoTab,
    closeAllTabs,
    setActiveTab,
    reorderPhotoTabs,
    navigateToPhoto,
    consumeNavDirection,
    consumeVisualization
  }

  return <PhotoLibraryContext.Provider value={value}>{children}</PhotoLibraryContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook are colocated by design
export function usePhotoLibrary(): PhotoLibraryContextValue {
  const ctx = useContext(PhotoLibraryContext)
  if (!ctx) throw new Error('usePhotoLibrary must be used within a PhotoLibraryProvider')
  return ctx
}
