import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react'

import { notifications } from '@mantine/notifications'

import { AiScanProgressToast, FaceScanProgressToast, MoveProgressToast } from '@components'
import { isUnderExcludedFolder } from '@shared/folderExclusion'
import type {
  AiScanProgress,
  AiScanResult,
  DefaultView,
  FaceRecord,
  FaceScanProgress,
  FaceScanResult,
  GalleryViewMode,
  PersonRecord,
  PhotoRecord,
  RotateDirection,
  SimilarPhoto,
  TagSuggestion,
  ThrowbackEntry,
  ThrowbackYearSample
} from '@shared/types'
import { basename, isPathUnderOrEqual, isPhotoInFolder, shuffle } from '@utils'
import { type DisplayMetadata, toDisplayMetadata } from '@utils'

import {
  type LibraryActions,
  PhotoLibraryActionsContext,
  useLibraryActions
} from './PhotoLibraryActionsContext'
import {
  type GalleryLibraryState,
  PhotoLibraryGalleryContext,
  type PhotoLibraryGalleryValue,
  useGalleryLibrary
} from './PhotoLibraryGalleryContext'
import {
  type GallerySortBy,
  type GallerySortOrder,
  initialState,
  MIN_COMPARE_PHOTOS,
  photoLibraryReducer,
  type PhotoLibraryState
} from './photoLibraryReducer'
import {
  PhotoLibraryScanProgressContext,
  type PhotoLibraryScanProgressValue
} from './PhotoLibraryScanProgressContext'
import {
  PhotoLibrarySidebarContext,
  type PhotoLibrarySidebarValue,
  type SidebarLibraryState,
  useSidebarLibrary
} from './PhotoLibrarySidebarContext'

// selectedPhoto is the only place metadata is ever rendered (DetailPanel), so
// only it gets the labeled/display-formatted shape — transforming the whole
// photos array on every render would be wasted work for fields nothing reads.
export interface DisplayPhotoRecord extends Omit<PhotoRecord, 'metadata'> {
  metadata: DisplayMetadata
}

// How long to wait after the last file-watcher event before summarizing the
// batch into a single toast, so a bulk copy/delete doesn't spam a toast per file.
const WATCH_NOTIFICATION_DEBOUNCE_MS = 1500

// Stable (not per-call) id — only one AI scan can be in flight app-wide at a
// time, so re-triggering updates the same toast instead of stacking a new one.
const AI_SCAN_NOTIFICATION_ID = 'ai-scan'
const FACE_SCAN_NOTIFICATION_ID = 'face-scan'

// Which arrow key drove a photo-to-photo navigation — 'right' means the
// photo being navigated to should visually enter from the right (the user
// stepped forward), 'left' means it enters from the left (stepped back).
export type NavigationDirection = 'left' | 'right'

// PhotoView's visualization mode ('none' = standard view). Lives here (not
// just as PhotoView-local state) so it can be threaded across arrow-key
// navigation below, which remounts a fresh PhotoView per photo.
export type PhotoVisualization =
  'none' | 'magazine' | 'newspaper' | 'dvd' | 'artGallery' | 'movieTheater'

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

// Covers compared by filePath + thumbnailKey (not object reference, which
// changes on every photo write regardless of relevance) — filePath catches a
// genuine cover-selection change, thumbnailKey catches the cover's own image
// changing (rotate/regenerate); a viewCount/comment-only write on the cover
// photo correctly counts as "no change" here.
function tagAggregatesEqual(
  prevCounts: Map<string, number>,
  prevCovers: Map<string, PhotoRecord>,
  nextCounts: Map<string, number>,
  nextCovers: Map<string, PhotoRecord>
): boolean {
  if (prevCounts.size !== nextCounts.size) return false
  for (const [tag, count] of prevCounts) {
    if (nextCounts.get(tag) !== count) return false
  }
  if (prevCovers.size !== nextCovers.size) return false
  for (const [tag, photo] of prevCovers) {
    const next = nextCovers.get(tag)
    if (!next || next.filePath !== photo.filePath || next.thumbnailKey !== photo.thumbnailKey) {
      return false
    }
  }
  return true
}

// Groups the flat (photo, person) rows from getFacePhotoAssignments by
// personId, for the gallery's filter-by-person lookup — see
// personPhotoAssignments on PhotoLibraryState.
function toPersonPhotoAssignments(
  rows: { photoPath: string; personId: string }[]
): Map<string, Set<string>> {
  const assignments = new Map<string, Set<string>>()
  for (const row of rows) {
    const paths = assignments.get(row.personId) ?? new Set<string>()
    paths.add(row.photoPath)
    assignments.set(row.personId, paths)
  }
  return assignments
}

// Scan progress is deliberately absent from this back-compat state shape —
// it lives in its own high-churn context (useScanProgress), so consuming it
// here would re-render every usePhotoLibrary consumer on each progress tick.
type PhotoLibraryComposedState = Omit<PhotoLibraryState, 'aiScanProgress' | 'faceScanProgress'>

interface PhotoLibraryContextValue {
  state: PhotoLibraryComposedState
  photos: PhotoRecord[]
  visiblePhotos: PhotoRecord[]
  // The library-wide "feature" photo set (excludes excluded-folder photos
  // unconditionally) — the choke point tags/Dashboard widgets should read
  // from instead of state.photosByPath, so exclusion isn't something each
  // one has to remember to apply itself.
  activePhotosByPath: Map<string, PhotoRecord>
  selectedPhoto: DisplayPhotoRecord | null
  allTags: string[]
  tagCounts: Map<string, number>
  tagCoverPhotos: Map<string, PhotoRecord>
  tagViewCounts: Map<string, number>
  untaggedCount: number
  folderTags: string[]
  folderHasUntagged: boolean
  addFolder: () => Promise<void>
  removeFolder: (folder: string) => Promise<void>
  renameFolder: (folder: string, newBaseName: string) => Promise<void>
  excludeFolder: (folder: string) => Promise<void>
  includeFolder: (folder: string) => Promise<void>
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
  deletePhotos: (filePaths: string[]) => Promise<void>
  setFolderFilter: (folder: string | null) => void
  setTagFilter: (tag: string | null) => void
  setFolderTagFilter: (tag: string | null) => void
  setPersonFilter: (personId: string | null) => void
  setUntaggedFilter: (active: boolean) => void
  setFolderUntaggedFilter: (active: boolean) => void
  setSort: (sortBy: GallerySortBy, sortOrder: GallerySortOrder) => void
  setDefaultView: (value: DefaultView) => void
  setShowEmptyFolders: (value: boolean) => void
  setTagsPanelGridView: (value: boolean) => void
  setPeoplePanelGridView: (value: boolean) => void
  setGalleryViewMode: (value: GalleryViewMode) => void
  setAiTagSuggestionsEnabled: (value: boolean) => void
  suggestTags: (filePath: string, candidateLabels: string[]) => Promise<TagSuggestion[]>
  findSimilarPhotos: (filePath: string, limit: number) => Promise<SimilarPhoto[]>
  dismissDuplicateGroup: (filePaths: string[]) => Promise<void>
  openDuplicatesTab: () => void
  getThrowbackSimilarity: () => Promise<ThrowbackEntry[] | null>
  getThrowbackYearSample: () => Promise<ThrowbackYearSample | null>
  getThrowbackPreview: () => Promise<ThrowbackEntry[] | null>
  // Downloads the model (if needed), enables the AI features flag, then runs
  // the shared scan (embedding + duplicate clustering) that warms tag
  // suggestions, duplicate detection, and Time Warp all at once. Drives its
  // own progress/"ready" toast directly, so it works regardless of which
  // component calls it.
  enableAiFeatures: () => Promise<AiScanResult>
  // Re-runs the shared scan without the model-download step (AI already on).
  rescanAiFeatures: () => Promise<AiScanResult>
  cancelAiScan: () => void
  setFaceDetectionEnabled: (value: boolean) => void
  // Enables face detection, then detects+groups faces across the library —
  // its own progress/"ready" toast, separate from enableAiFeatures since
  // it's an independent, heavier opt-in pass.
  enableFaceDetection: () => Promise<FaceScanResult>
  rescanFaces: () => Promise<FaceScanResult>
  cancelFaceScan: () => void
  getFacesForPhoto: (filePath: string) => Promise<FaceRecord[]>
  refreshPeople: () => Promise<void>
  renamePerson: (id: string, name: string) => Promise<void>
  assignFaceToPerson: (faceId: string, personId: string) => Promise<void>
  splitFaceAsNewPerson: (faceId: string) => Promise<void>
  unassignFace: (faceId: string) => Promise<void>
  mergePeople: (sourcePersonId: string, targetPersonId: string) => Promise<void>
  deletePerson: (id: string) => Promise<void>
  setPersonDescription: (id: string, description: string) => Promise<void>
  hidePerson: (id: string) => Promise<void>
  unhidePerson: (id: string) => Promise<void>
  getHiddenPeople: () => Promise<PersonRecord[]>
  setNavbarSplitSizes: (sizes: number[]) => void
  setNavbarWidth: (width: number) => void
  setNavbarCollapsedPanels: (panels: Record<string, boolean>) => void
  setSettingsModalOpened: (value: boolean) => void
  setDetailsPanelCollapsed: (value: boolean) => void
  setGalleryAnimationsEnabled: (value: boolean) => void
  setShowFilenames: (value: boolean) => void
  setShowViewCounts: (value: boolean) => void
  setMagazineTitle: (value: string) => void
  setNewspaperTitle: (value: string) => void
  setDvdStudioName: (value: string) => void
  setArtGalleryName: (value: string) => void
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

export function PhotoLibraryProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, dispatch] = useReducer(photoLibraryReducer, initialState)
  // Lets actions below read the latest state without closing over `state`
  // itself — an action that closes over `state` gets a new identity on every
  // dispatch anywhere, which (bundled together for the actions context, see
  // PhotoLibraryActionsContext) would otherwise re-render every actions
  // consumer on every unrelated state change, the same class of bug this
  // whole context split is fixing.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
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

  // Renders AppLayout as soon as folders are known, instead of blocking on
  // the full startup scan — photos stream in progressively via METADATA_BATCH.
  // Folders and settings are fetched in parallel (one round-trip each,
  // instead of ~20 separate settings calls) but kept as separate API calls
  // since folders alone drives the scan below.
  useEffect(() => {
    Promise.all([window.api.getFolders(), window.api.getAllSettings()]).then(
      ([folders, settings]) => {
        dispatch({ type: 'FOLDERS_LOADED', folders })
        dispatch({ type: 'SETTINGS_LOADED', settings })
        dispatch({ type: 'SET_ACTIVE_TAB', tab: settings.defaultView })
        dispatch({ type: 'INITIAL_LOAD_COMPLETE' })
        void startScanForAll(folders)
        if (settings.faceDetectionEnabled) {
          window.api.getPeople().then((people) => dispatch({ type: 'SET_PEOPLE', people }))
          window.api.getFacePhotoAssignments().then((rows) =>
            dispatch({
              type: 'SET_PERSON_PHOTO_ASSIGNMENTS',
              assignments: toPersonPhotoAssignments(rows)
            })
          )
        }
      }
    )
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

  const removeFolder = useCallback(async (folder: string) => {
    const count = stateRef.current.folderCounts.get(folder) ?? 0
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
  }, [])

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
    await startScanForAll(stateRef.current.folders)
  }, [startScanForAll])

  // A plain click always replaces the whole selection with just this photo —
  // both the DetailPanel-primary pointer and the multi-select batch.
  const selectPhoto = useCallback((path: string | null) => {
    dispatch({ type: 'SELECT_PHOTO', path })
    dispatch({ type: 'SET_SELECTED_PATHS', paths: path ? [path] : [] })
  }, [])

  const toggleSelectPhoto = useCallback((path: string) => {
    const next = new Set(stateRef.current.selectedPaths)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    dispatch({ type: 'SET_SELECTED_PATHS', paths: Array.from(next) })
    dispatch({ type: 'SELECT_PHOTO', path })
  }, [])

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
    (tags: string[]) => addTagsToPhotos(tags, Array.from(stateRef.current.selectedPaths)),
    [addTagsToPhotos]
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
    (tags: string[]) => removeTagsFromPhotos(tags, Array.from(stateRef.current.selectedPaths)),
    [removeTagsFromPhotos]
  )

  // Drag-and-drop onto a folder row moves the dragged photo(s) into it. Mirrors
  // renameFile's dispatch sequence (a cross-folder move is structurally the
  // same as a rename — same DB row, new full path) for each moved photo, plus
  // re-pointing selectedPath/selectedPaths from old to new paths since a move
  // (unlike a same-folder rename) can be triggered on a multi-selection.
  const movePhotosToFolder = useCallback(async (filePaths: string[], destFolder: string) => {
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
      if (stateRef.current.selectedPath && pathMap.has(stateRef.current.selectedPath)) {
        dispatch({ type: 'SELECT_PHOTO', path: pathMap.get(stateRef.current.selectedPath)! })
      }
      if (
        stateRef.current.selectedPaths.size > 0 &&
        moved.some(({ oldPath }) => pathMap.has(oldPath))
      ) {
        dispatch({
          type: 'SET_SELECTED_PATHS',
          paths: Array.from(stateRef.current.selectedPaths, (path) => pathMap.get(path) ?? path)
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
  }, [])

  // Moves each file to the OS trash (main process) then reuses PHOTO_REMOVED
  // for cleanup — same reducer case the watcher's own unlink detection
  // dispatches, so selection/open-tab/folder-count bookkeeping isn't
  // duplicated here.
  const deletePhotos = useCallback(async (filePaths: string[]) => {
    if (filePaths.length === 0) return
    const deleted = await window.api.deletePhotos(filePaths)
    for (const filePath of deleted) {
      dispatch({ type: 'PHOTO_REMOVED', filePath })
    }
    if (deleted.length < filePaths.length) {
      notifications.show({
        color: 'red',
        message: `Failed to delete ${pluralize(filePaths.length - deleted.length, 'photo')}`
      })
    }
  }, [])

  const updateTags = useCallback(
    async (filePath: string, tags: string[]) => {
      const current = stateRef.current.photosByPath.get(filePath)
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
    [loadTagGroupsData]
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

  const setPersonFilter = useCallback((personId: string | null) => {
    dispatch({ type: 'SET_PERSON_FILTER', personId })
  }, [])

  const setUntaggedFilter = useCallback((active: boolean) => {
    dispatch({ type: 'SET_UNTAGGED_FILTER', active })
  }, [])

  const setFolderUntaggedFilter = useCallback((active: boolean) => {
    dispatch({ type: 'SET_FOLDER_UNTAGGED_FILTER', active })
  }, [])

  const setTagDescription = useCallback(async (tag: string, description: string) => {
    const previous = stateRef.current.tagDescriptions.get(tag) ?? ''
    dispatch({ type: 'TAG_DESCRIPTION_UPDATED', tag, description })
    try {
      await window.api.setTagDescription(tag, description)
    } catch (err) {
      console.error(`failed to save description for tag ${tag}`, err)
      notifications.show({ color: 'red', message: 'Failed to save tag description' })
      dispatch({ type: 'TAG_DESCRIPTION_UPDATED', tag, description: previous })
    }
  }, [])

  const renameTag = useCallback(
    async (oldTag: string, newTag: string) => {
      const filePaths = Array.from(stateRef.current.photosByPath.values())
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
    [loadTagGroupsData]
  )

  const deleteTag = useCallback(
    async (tag: string) => {
      const filePaths = Array.from(stateRef.current.photosByPath.values())
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
    [loadTagGroupsData]
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

  const renameFile = useCallback(async (filePath: string, newBaseName: string) => {
    try {
      const photo = await window.api.renamePhoto(filePath, newBaseName)
      const wasSelected = stateRef.current.selectedPath === filePath
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
  }, [])

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

  const setPeoplePanelGridView = useCallback((value: boolean) => {
    dispatch({ type: 'SET_PEOPLE_PANEL_GRID_VIEW', value })
    void window.api.setPeoplePanelGridView(value)
  }, [])

  const setGalleryViewMode = useCallback((value: GalleryViewMode) => {
    dispatch({ type: 'SET_GALLERY_VIEW_MODE', value })
    void window.api.setGalleryViewMode(value)
  }, [])

  const setAiTagSuggestionsEnabled = useCallback((value: boolean) => {
    dispatch({ type: 'SET_AI_TAG_SUGGESTIONS_ENABLED', value })
    void window.api.setAiTagSuggestionsEnabled(value)
  }, [])

  const setFaceDetectionEnabled = useCallback((value: boolean) => {
    dispatch({ type: 'SET_FACE_DETECTION_ENABLED', value })
    void window.api.setFaceDetectionEnabled(value)
  }, [])

  // Refreshes both the people list and the gallery's filter-by-person
  // lookup together — a face reassignment changes both at once, so every
  // caller of this needs both in sync rather than picking one.
  const refreshPeople = useCallback(async () => {
    const [people, assignmentRows] = await Promise.all([
      window.api.getPeople(),
      window.api.getFacePhotoAssignments()
    ])
    dispatch({ type: 'SET_PEOPLE', people })
    dispatch({
      type: 'SET_PERSON_PHOTO_ASSIGNMENTS',
      assignments: toPersonPhotoAssignments(assignmentRows)
    })
  }, [])

  const getFacesForPhoto = useCallback(
    (filePath: string) => window.api.getFacesForPhoto(filePath),
    []
  )

  const renamePerson = useCallback(
    async (id: string, name: string) => {
      await window.api.renamePerson(id, name)
      await refreshPeople()
    },
    [refreshPeople]
  )

  const assignFaceToPerson = useCallback(
    async (faceId: string, personId: string) => {
      await window.api.assignFaceToPerson(faceId, personId)
      await refreshPeople()
    },
    [refreshPeople]
  )

  const splitFaceAsNewPerson = useCallback(
    async (faceId: string) => {
      await window.api.splitFaceAsNewPerson(faceId)
      await refreshPeople()
    },
    [refreshPeople]
  )

  const unassignFace = useCallback(
    async (faceId: string) => {
      await window.api.unassignFace(faceId)
      await refreshPeople()
    },
    [refreshPeople]
  )

  const mergePeople = useCallback(
    async (sourcePersonId: string, targetPersonId: string) => {
      await window.api.mergePeople(sourcePersonId, targetPersonId)
      await refreshPeople()
    },
    [refreshPeople]
  )

  const deletePerson = useCallback(
    async (id: string) => {
      await window.api.deletePerson(id)
      await refreshPeople()
    },
    [refreshPeople]
  )

  const setPersonDescription = useCallback(
    async (id: string, description: string) => {
      await window.api.setPersonDescription(id, description)
      await refreshPeople()
    },
    [refreshPeople]
  )

  const hidePerson = useCallback(
    async (id: string) => {
      await window.api.hidePerson(id)
      await refreshPeople()
    },
    [refreshPeople]
  )

  const unhidePerson = useCallback(
    async (id: string) => {
      await window.api.unhidePerson(id)
      await refreshPeople()
    },
    [refreshPeople]
  )

  const getHiddenPeople = useCallback(() => window.api.getHiddenPeople(), [])

  const suggestTags = useCallback(
    (filePath: string, candidateLabels: string[]) =>
      window.api.suggestTags(filePath, candidateLabels),
    []
  )

  const findSimilarPhotos = useCallback(
    (filePath: string, limit: number) => window.api.findSimilarPhotos(filePath, limit),
    []
  )

  const dismissDuplicateGroup = useCallback(
    (filePaths: string[]) => window.api.dismissDuplicateGroup(filePaths),
    []
  )

  const openDuplicatesTab = useCallback(() => {
    dispatch({ type: 'OPEN_DUPLICATES_TAB' })
  }, [])

  const getThrowbackSimilarity = useCallback(
    (): Promise<ThrowbackEntry[] | null> => window.api.getThrowbackSimilarity(),
    []
  )

  const getThrowbackYearSample = useCallback(
    (): Promise<ThrowbackYearSample | null> => window.api.getThrowbackYearSample(),
    []
  )

  const getThrowbackPreview = useCallback(
    (): Promise<ThrowbackEntry[] | null> => window.api.getThrowbackPreview(),
    []
  )

  // Shared by enableAiFeatures/rescanAiFeatures below — drives the progress
  // toast directly from the action itself (same pattern movePhotosToFolder
  // uses above), rather than a mounted component's effect, which is what
  // makes it work "regardless of where the scan is kicked off."
  const runAiScan = useCallback(
    async (invoke: () => Promise<AiScanResult>): Promise<AiScanResult> => {
      const handleCancel = (): void => void window.api.cancelAiScan()
      const initialProgress: AiScanProgress = { phase: 'downloading', done: 0, total: 100 }
      dispatch({ type: 'SET_AI_SCAN_PROGRESS', progress: initialProgress })
      notifications.show({
        id: AI_SCAN_NOTIFICATION_ID,
        autoClose: false,
        withCloseButton: true,
        onClose: handleCancel,
        message: <AiScanProgressToast progress={initialProgress} onCancel={handleCancel} />
      })
      const unsubscribe = window.api.onAiScanProgress((progress) => {
        dispatch({ type: 'SET_AI_SCAN_PROGRESS', progress })
        // The backend only flips the setting once the model download
        // finishes and the scan itself starts (see enableAiFeaturesAndScan)
        // — mirrored here, rather than optimistically enabling on click, so
        // a cancel during download correctly leaves it off. The reducer
        // guards this action, so the repeat dispatches on later ticks are
        // cheap no-ops.
        if (progress.phase === 'embedding') {
          dispatch({ type: 'SET_AI_TAG_SUGGESTIONS_ENABLED', value: true })
        }
        notifications.update({
          id: AI_SCAN_NOTIFICATION_ID,
          message: <AiScanProgressToast progress={progress} onCancel={handleCancel} />
        })
      })
      try {
        const result = await invoke()
        notifications.update({
          id: AI_SCAN_NOTIFICATION_ID,
          color: result.canceled ? 'yellow' : 'teal',
          autoClose: 4000,
          message: result.canceled
            ? 'AI scan canceled.'
            : result.photosScanned === 0
              ? 'AI features enabled — add some photos to get suggestions and duplicate detection.'
              : 'AI features ready.'
        })
        return result
      } catch (err) {
        notifications.update({
          id: AI_SCAN_NOTIFICATION_ID,
          color: 'red',
          autoClose: 4000,
          message: 'Something went wrong scanning your library.'
        })
        throw err
      } finally {
        unsubscribe()
        dispatch({ type: 'SET_AI_SCAN_PROGRESS', progress: null })
      }
    },
    []
  )

  const enableAiFeatures = useCallback(
    () => runAiScan(() => window.api.enableAiFeaturesAndScan()),
    [runAiScan]
  )

  const rescanAiFeatures = useCallback(
    () => runAiScan(() => window.api.rescanAiFeatures()),
    [runAiScan]
  )

  const cancelAiScan = useCallback(() => {
    void window.api.cancelAiScan()
  }, [])

  // Mirrors runAiScan above — models are bundled (no download phase), so
  // this starts directly at 'detecting'.
  const runFaceScan = useCallback(
    async (invoke: () => Promise<FaceScanResult>): Promise<FaceScanResult> => {
      const handleCancel = (): void => void window.api.cancelFaceScan()
      const initialProgress: FaceScanProgress = { phase: 'detecting', done: 0, total: 100 }
      dispatch({ type: 'SET_FACE_SCAN_PROGRESS', progress: initialProgress })
      notifications.show({
        id: FACE_SCAN_NOTIFICATION_ID,
        autoClose: false,
        withCloseButton: true,
        onClose: handleCancel,
        message: <FaceScanProgressToast progress={initialProgress} onCancel={handleCancel} />
      })
      const unsubscribe = window.api.onFaceScanProgress((progress) => {
        dispatch({ type: 'SET_FACE_SCAN_PROGRESS', progress })
        notifications.update({
          id: FACE_SCAN_NOTIFICATION_ID,
          message: <FaceScanProgressToast progress={progress} onCancel={handleCancel} />
        })
      })
      try {
        const result = await invoke()
        await refreshPeople()
        notifications.update({
          id: FACE_SCAN_NOTIFICATION_ID,
          color: result.canceled ? 'yellow' : 'teal',
          autoClose: 4000,
          message: result.canceled
            ? 'Face scan canceled.'
            : result.facesDetected === 0
              ? 'Face detection enabled — no faces found yet.'
              : 'Face grouping ready.'
        })
        return result
      } catch (err) {
        notifications.update({
          id: FACE_SCAN_NOTIFICATION_ID,
          color: 'red',
          autoClose: 4000,
          message: 'Something went wrong scanning your library for faces.'
        })
        throw err
      } finally {
        unsubscribe()
        dispatch({ type: 'SET_FACE_SCAN_PROGRESS', progress: null })
      }
    },
    [refreshPeople]
  )

  const enableFaceDetection = useCallback(() => {
    // Mirrors faceScanService.enableFaceDetectionAndScan, which flips the
    // backend setting immediately (no download step to gate on, unlike AI's
    // 'embedding'-phase dispatch) — without this, the People panel (gated on
    // state.faceDetectionEnabled) wouldn't appear until the next reload.
    dispatch({ type: 'SET_FACE_DETECTION_ENABLED', value: true })
    return runFaceScan(() => window.api.enableFaceDetectionAndScan())
  }, [runFaceScan])

  const rescanFaces = useCallback(() => runFaceScan(() => window.api.rescanFaces()), [runFaceScan])

  const cancelFaceScan = useCallback(() => {
    void window.api.cancelFaceScan()
  }, [])

  // A scan still marked "in progress" on launch means the app quit before it
  // finished, not that it was resolved/canceled — resume it silently (the
  // toast reappears via rescanAiFeatures/runAiScan) rather than leaving it
  // stuck forever. Cheap even for a full library since embeddings already
  // computed are cached in the DB.
  useEffect(() => {
    window.api.wasAiScanInterrupted().then((interrupted) => {
      if (interrupted) void rescanAiFeatures()
    })
  }, [rescanAiFeatures])

  const setNavbarSplitSizes = useCallback((sizes: number[]) => {
    dispatch({ type: 'SET_NAVBAR_SPLIT_SIZES', sizes })
    void window.api.setNavbarSplitSizes(sizes)
  }, [])

  const setNavbarWidth = useCallback((width: number) => {
    dispatch({ type: 'SET_NAVBAR_WIDTH', width })
    void window.api.setNavbarWidth(width)
  }, [])

  const setNavbarCollapsedPanels = useCallback((panels: Record<string, boolean>) => {
    dispatch({ type: 'SET_NAVBAR_COLLAPSED_PANELS', panels })
    void window.api.setNavbarCollapsedPanels(panels)
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

  const setArtGalleryName = useCallback((value: string) => {
    dispatch({ type: 'SET_ART_GALLERY_NAME', value })
    void window.api.setArtGalleryName(value)
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

  // No rescan needed — unlike excludePatterns, this never touches
  // scanning/watching, so the persisted change alone is enough; every
  // consumer (tags, AI, dashboard) already re-derives from live state.
  const excludeFolder = useCallback(async (folder: string) => {
    const current = stateRef.current.excludedFolders
    const folders = current.includes(folder) ? current : [...current, folder]
    dispatch({ type: 'SET_EXCLUDED_FOLDERS', folders })
    await window.api.setExcludedFolders(folders)
  }, [])

  const includeFolder = useCallback(async (folder: string) => {
    const folders = stateRef.current.excludedFolders.filter((f) => f !== folder)
    dispatch({ type: 'SET_EXCLUDED_FOLDERS', folders })
    await window.api.setExcludedFolders(folders)
  }, [])

  // True while the current folder view is scoped to (at or under) an
  // excluded folder — the one deliberate way to still browse its photos,
  // per the "except in the folder tree" carve-out.
  const isViewingExcludedFolderDirectly = useMemo(() => {
    if (!state.selectedFolder) return false
    return state.excludedFolders.some((folder) => isPathUnderOrEqual(state.selectedFolder!, folder))
  }, [state.selectedFolder, state.excludedFolders])

  // Folder and tag filters stack rather than being mutually exclusive, so a
  // folder-scoped tag pill (see GalleryGrid's header) can narrow within the
  // current folder instead of replacing it with a folder-agnostic tag view.
  // Folder narrowing is applied before untagged/tag so both the global
  // untagged view (no selectedFolder — SET_UNTAGGED_FILTER clears it) and
  // the folder pill row's own "Untagged" entry (selectedFolder stays set —
  // SET_FOLDER_UNTAGGED_FILTER) fall out of the same code path.
  const visiblePhotos = useMemo(() => {
    let result = photos
    if (!isViewingExcludedFolderDirectly) {
      result = result.filter(
        (photo) => !isUnderExcludedFolder(photo.filePath, state.excludedFolders)
      )
    }
    if (state.selectedFolder) {
      result = result.filter((photo) => isPhotoInFolder(photo.filePath, state.selectedFolder!))
    }
    if (state.untaggedFilterActive) {
      return result.filter((photo) => photo.tags.length === 0)
    }
    if (state.selectedTag) {
      result = result.filter((photo) => photo.tags.includes(state.selectedTag!))
    }
    // SET_PERSON_FILTER clears selectedTag/selectedFolder (see the reducer),
    // so this never combines with them — same "one primary filter" model.
    if (state.selectedPerson) {
      const personPhotoPaths = state.personPhotoAssignments.get(state.selectedPerson)
      result = result.filter((photo) => personPhotoPaths?.has(photo.filePath))
    }
    return result
  }, [
    photos,
    state.selectedFolder,
    state.selectedTag,
    state.selectedPerson,
    state.personPhotoAssignments,
    state.untaggedFilterActive,
    state.excludedFolders,
    isViewingExcludedFolderDirectly
  ])
  // Lets selectPhotoRange below read the latest visiblePhotos without
  // closing over it directly — same stateRef reasoning as above.
  const visiblePhotosRef = useRef(visiblePhotos)
  useEffect(() => {
    visiblePhotosRef.current = visiblePhotos
  }, [visiblePhotos])

  // Shift+click range-select, anchored at the current selectedPath (the
  // last-engaged photo) through targetPath, within the currently visible
  // (filtered) gallery order. Simplification vs. a strict Finder-style fixed
  // anchor: selectedPath — and so the anchor for the *next* Shift+click —
  // moves to targetPath each time, rather than staying pinned to the first
  // click of the sequence.
  const selectPhotoRange = useCallback((targetPath: string) => {
    const anchorPath = stateRef.current.selectedPath
    if (!anchorPath) {
      dispatch({ type: 'SET_SELECTED_PATHS', paths: [targetPath] })
      dispatch({ type: 'SELECT_PHOTO', path: targetPath })
      return
    }
    const ordered = visiblePhotosRef.current.map((photo) => photo.filePath)
    const anchorIndex = ordered.indexOf(anchorPath)
    const targetIndex = ordered.indexOf(targetPath)
    if (anchorIndex === -1 || targetIndex === -1) return
    const [start, end] =
      anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
    dispatch({ type: 'SET_SELECTED_PATHS', paths: ordered.slice(start, end + 1) })
    dispatch({ type: 'SELECT_PHOTO', path: targetPath })
  }, [])

  // While a photo-view tab is active, DetailPanel should track that tab's
  // photo (not the gallery's own selection cursor, which keeps whatever it
  // last was and can point somewhere else entirely) — the active tab's path
  // wins whenever it isn't the 'gallery' tab itself.
  const selectedPhoto = useMemo(() => {
    const path = state.activeTab !== 'gallery' ? state.activeTab : state.selectedPath
    const raw = path ? (state.photosByPath.get(path) ?? null) : null
    return raw ? { ...raw, metadata: toDisplayMetadata(raw.metadata) } : null
  }, [state.selectedPath, state.activeTab, state.photosByPath])

  // The library-wide "feature" photo set — excludes photos under an excluded
  // folder unconditionally (unlike visiblePhotos, this has no "direct
  // browse" exception, since tags/dashboard widgets aren't folder-scoped
  // navigation). Single choke point: tag aggregation and every Dashboard
  // widget read from this instead of state.photosByPath directly, so a new
  // feature written the normal way inherits the exclusion for free.
  const activePhotosByPath = useMemo(() => {
    if (state.excludedFolders.length === 0) return state.photosByPath
    const filtered = new Map<string, PhotoRecord>()
    for (const [filePath, photo] of state.photosByPath) {
      if (!isUnderExcludedFolder(filePath, state.excludedFolders)) filtered.set(filePath, photo)
    }
    return filtered
  }, [state.photosByPath, state.excludedFolders])

  // Tag covers always pick the most-recently-taken photo, independent of the
  // gallery's own sort order/direction — otherwise switching gallery sort
  // would make tag thumbnails jump around. Iterates activePhotosByPath
  // directly (not the sorted `photos`) since order doesn't matter here.
  //
  // Stabilized against its own previous output (see tagAggregatesEqual)
  // rather than just publishing whatever activePhotosByPath produces: a
  // passive write like a hover-driven view-count bump still gives
  // activePhotosByPath a new identity (see PHOTO_UPSERTED), but never
  // changes which tags exist or which photo is each tag's cover —
  // recomputing here is cheap, but publishing a "changed" reference every
  // time cascades into re-rendering every sidebar row that reads
  // tagCounts/tagCoverPhotos, which is the actual cost we're avoiding.
  // Uses state (committed in an effect), not a ref read during render,
  // since the latter is an eslint-enforced anti-pattern here (react-hooks/
  // refs) — React bails out of the setState below when the updater returns
  // the same object back, so an unrelated write still costs one extra
  // (otherwise-invisible) render, not a published reference change.
  const rawTagAggregates = useMemo(() => {
    const counts = new Map<string, number>()
    const covers = new Map<string, PhotoRecord>()
    for (const photo of activePhotosByPath.values()) {
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
  }, [activePhotosByPath])
  // The React-docs-endorsed "adjust state during render" pattern (calling
  // setState conditionally in the render body, not in an effect) — updates
  // synchronously before this render commits, so a genuine change shows up
  // immediately with no extra visible frame, while an irrelevant change
  // (rawTagAggregates recomputed but content-equal) never calls setState at
  // all, so tagAggregates — and everything downstream of it — keeps its
  // existing reference.
  const [tagAggregates, setTagAggregates] = useState(rawTagAggregates)
  if (
    !tagAggregatesEqual(
      tagAggregates.tagCounts,
      tagAggregates.tagCoverPhotos,
      rawTagAggregates.tagCounts,
      rawTagAggregates.tagCoverPhotos
    )
  ) {
    setTagAggregates(rawTagAggregates)
  }
  const { tagCounts, tagCoverPhotos } = tagAggregates

  // Split out from tagCounts/tagCoverPhotos above (rather than computed in
  // the same pass) specifically because this one SHOULD get a new reference
  // on every view-count change — bundling it with the stabilized pair would
  // force them to publish a new reference too on every hover.
  const tagViewCounts = useMemo(() => {
    const viewCounts = new Map<string, number>()
    for (const photo of activePhotosByPath.values()) {
      for (const tag of photo.tags) {
        viewCounts.set(tag, (viewCounts.get(tag) ?? 0) + photo.viewCount)
      }
    }
    return viewCounts
  }, [activePhotosByPath])

  const untaggedCount = useMemo(() => {
    let count = 0
    for (const photo of activePhotosByPath.values()) {
      if (photo.tags.length === 0) count++
    }
    return count
  }, [activePhotosByPath])

  const allTags = useMemo(() => Array.from(tagCounts.keys()).sort(), [tagCounts])

  // Tags found among photos in the currently selected folder (independent of
  // any active tag filter), used to render the folder's tag pills. Same
  // stabilize-against-previous-output reasoning as tagCounts/tagCoverPhotos
  // above — `photos` gets a new identity on every photo write.
  const rawFolderTags = useMemo(() => {
    if (!state.selectedFolder) return { folderTags: [], folderHasUntagged: false }
    const tags = new Set<string>()
    let hasUntagged = false
    for (const photo of photos) {
      if (!isPhotoInFolder(photo.filePath, state.selectedFolder!)) continue
      // An excluded subfolder's tags shouldn't leak into an ancestor
      // folder's pill row — unless selectedFolder is that excluded folder
      // (or under it) itself, the direct-browse exception.
      if (
        !isViewingExcludedFolderDirectly &&
        isUnderExcludedFolder(photo.filePath, state.excludedFolders)
      ) {
        continue
      }
      if (photo.tags.length === 0) hasUntagged = true
      for (const tag of photo.tags) tags.add(tag)
    }
    return { folderTags: Array.from(tags).sort(), folderHasUntagged: hasUntagged }
  }, [photos, state.selectedFolder, state.excludedFolders, isViewingExcludedFolderDirectly])
  // Same render-time adjustment pattern as tagAggregates above.
  const [folderTagsState, setFolderTagsState] = useState(rawFolderTags)
  const folderTagsUnchanged =
    folderTagsState.folderHasUntagged === rawFolderTags.folderHasUntagged &&
    folderTagsState.folderTags.length === rawFolderTags.folderTags.length &&
    folderTagsState.folderTags.every((tag, index) => tag === rawFolderTags.folderTags[index])
  if (!folderTagsUnchanged) {
    setFolderTagsState(rawFolderTags)
  }
  const { folderTags, folderHasUntagged } = folderTagsState

  // personId -> cover photo's thumbnailKey — computed here (mirrors
  // tagCoverPhotos) so PersonRow can read it from PhotoLibrarySidebarContext
  // instead of reaching into photosByPath directly, which would otherwise
  // force it to subscribe to the high-churn Gallery-bucket state.
  const personCoverPhotos = useMemo(() => {
    const covers = new Map<string, string | null>()
    for (const person of state.people) {
      covers.set(
        person.id,
        person.coverPhotoPath
          ? (activePhotosByPath.get(person.coverPhotoPath)?.thumbnailKey ?? null)
          : null
      )
    }
    return covers
  }, [state.people, activePhotosByPath])

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

  // All actions are permanently-stable useCallbacks (see stateRef/
  // visiblePhotosRef above), so this bag's identity never changes across
  // renders — consuming it alone never causes a re-render.
  const actions: LibraryActions = useMemo(
    () => ({
      addFolder,
      removeFolder,
      renameFolder,
      excludeFolder,
      includeFolder,
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
      deletePhotos,
      setFolderFilter,
      setTagFilter,
      setFolderTagFilter,
      setPersonFilter,
      setUntaggedFilter,
      setFolderUntaggedFilter,
      setSort,
      setDefaultView,
      setShowEmptyFolders,
      setTagsPanelGridView,
      setPeoplePanelGridView,
      setGalleryViewMode,
      setAiTagSuggestionsEnabled,
      suggestTags,
      findSimilarPhotos,
      dismissDuplicateGroup,
      openDuplicatesTab,
      getThrowbackSimilarity,
      getThrowbackYearSample,
      getThrowbackPreview,
      enableAiFeatures,
      rescanAiFeatures,
      cancelAiScan,
      setFaceDetectionEnabled,
      enableFaceDetection,
      rescanFaces,
      cancelFaceScan,
      getFacesForPhoto,
      refreshPeople,
      renamePerson,
      assignFaceToPerson,
      splitFaceAsNewPerson,
      unassignFace,
      mergePeople,
      deletePerson,
      setPersonDescription,
      hidePerson,
      unhidePerson,
      getHiddenPeople,
      setNavbarSplitSizes,
      setNavbarWidth,
      setNavbarCollapsedPanels,
      setSettingsModalOpened,
      setDetailsPanelCollapsed,
      setGalleryAnimationsEnabled,
      setShowFilenames,
      setShowViewCounts,
      setMagazineTitle,
      setNewspaperTitle,
      setDvdStudioName,
      setArtGalleryName,
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
    }),
    [
      addFolder,
      removeFolder,
      renameFolder,
      excludeFolder,
      includeFolder,
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
      deletePhotos,
      setFolderFilter,
      setTagFilter,
      setFolderTagFilter,
      setPersonFilter,
      setUntaggedFilter,
      setFolderUntaggedFilter,
      setSort,
      setDefaultView,
      setShowEmptyFolders,
      setTagsPanelGridView,
      setPeoplePanelGridView,
      setGalleryViewMode,
      setAiTagSuggestionsEnabled,
      suggestTags,
      findSimilarPhotos,
      dismissDuplicateGroup,
      openDuplicatesTab,
      getThrowbackSimilarity,
      getThrowbackYearSample,
      getThrowbackPreview,
      enableAiFeatures,
      rescanAiFeatures,
      cancelAiScan,
      setFaceDetectionEnabled,
      enableFaceDetection,
      rescanFaces,
      cancelFaceScan,
      getFacesForPhoto,
      refreshPeople,
      renamePerson,
      assignFaceToPerson,
      splitFaceAsNewPerson,
      unassignFace,
      mergePeople,
      deletePerson,
      setPersonDescription,
      hidePerson,
      unhidePerson,
      getHiddenPeople,
      setNavbarSplitSizes,
      setNavbarWidth,
      setNavbarCollapsedPanels,
      setSettingsModalOpened,
      setDetailsPanelCollapsed,
      setGalleryAnimationsEnabled,
      setShowFilenames,
      setShowViewCounts,
      setMagazineTitle,
      setNewspaperTitle,
      setDvdStudioName,
      setArtGalleryName,
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
    ]
  )

  const faceScanInProgress = state.faceScanProgress !== null
  const sidebarState: SidebarLibraryState = useMemo(
    () => ({
      folders: state.folders,
      folderCounts: state.folderCounts,
      folderChildren: state.folderChildren,
      allFolderPaths: state.allFolderPaths,
      excludedFolders: state.excludedFolders,
      showEmptyFolders: state.showEmptyFolders,
      selectedFolder: state.selectedFolder,
      selectedTag: state.selectedTag,
      selectedPerson: state.selectedPerson,
      untaggedFilterActive: state.untaggedFilterActive,
      people: state.people,
      personPhotoAssignments: state.personPhotoAssignments,
      faceDetectionEnabled: state.faceDetectionEnabled,
      faceScanInProgress,
      peoplePanelGridView: state.peoplePanelGridView,
      tagsPanelGridView: state.tagsPanelGridView,
      tagGroups: state.tagGroups,
      tagGroupAssignments: state.tagGroupAssignments,
      tagDescriptions: state.tagDescriptions,
      recentTags: state.recentTags,
      navbarSplitSizes: state.navbarSplitSizes,
      navbarWidth: state.navbarWidth,
      navbarCollapsedPanels: state.navbarCollapsedPanels
    }),
    [
      state.folders,
      state.folderCounts,
      state.folderChildren,
      state.allFolderPaths,
      state.excludedFolders,
      state.showEmptyFolders,
      state.selectedFolder,
      state.selectedTag,
      state.selectedPerson,
      state.untaggedFilterActive,
      state.people,
      state.personPhotoAssignments,
      state.faceDetectionEnabled,
      faceScanInProgress,
      state.peoplePanelGridView,
      state.tagsPanelGridView,
      state.tagGroups,
      state.tagGroupAssignments,
      state.tagDescriptions,
      state.recentTags,
      state.navbarSplitSizes,
      state.navbarWidth,
      state.navbarCollapsedPanels
    ]
  )
  const sidebarValue: PhotoLibrarySidebarValue = useMemo(
    () => ({
      state: sidebarState,
      allTags,
      tagCounts,
      tagCoverPhotos,
      tagViewCounts,
      untaggedCount,
      folderTags,
      folderHasUntagged,
      personCoverPhotos
    }),
    [
      sidebarState,
      allTags,
      tagCounts,
      tagCoverPhotos,
      tagViewCounts,
      untaggedCount,
      folderTags,
      folderHasUntagged,
      personCoverPhotos
    ]
  )

  const galleryState: GalleryLibraryState = useMemo(
    () => ({
      photosByPath: state.photosByPath,
      selectedPath: state.selectedPath,
      selectedPaths: state.selectedPaths,
      status: state.status,
      initialLoadComplete: state.initialLoadComplete,
      filesFound: state.filesFound,
      cacheHits: state.cacheHits,
      errors: state.errors,
      scanId: state.scanId,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      galleryViewMode: state.galleryViewMode,
      galleryAnimationsEnabled: state.galleryAnimationsEnabled,
      showFilenames: state.showFilenames,
      showViewCounts: state.showViewCounts,
      defaultView: state.defaultView,
      aiTagSuggestionsEnabled: state.aiTagSuggestionsEnabled,
      settingsModalOpened: state.settingsModalOpened,
      detailsPanelCollapsed: state.detailsPanelCollapsed,
      magazineTitle: state.magazineTitle,
      newspaperTitle: state.newspaperTitle,
      dvdStudioName: state.dvdStudioName,
      artGalleryName: state.artGalleryName,
      excludePatterns: state.excludePatterns,
      openTabs: state.openTabs,
      activeTab: state.activeTab,
      compareTabs: state.compareTabs
    }),
    [
      state.photosByPath,
      state.selectedPath,
      state.selectedPaths,
      state.status,
      state.initialLoadComplete,
      state.filesFound,
      state.cacheHits,
      state.errors,
      state.scanId,
      state.sortBy,
      state.sortOrder,
      state.galleryViewMode,
      state.galleryAnimationsEnabled,
      state.showFilenames,
      state.showViewCounts,
      state.defaultView,
      state.aiTagSuggestionsEnabled,
      state.settingsModalOpened,
      state.detailsPanelCollapsed,
      state.magazineTitle,
      state.newspaperTitle,
      state.dvdStudioName,
      state.artGalleryName,
      state.excludePatterns,
      state.openTabs,
      state.activeTab,
      state.compareTabs
    ]
  )
  const galleryValue: PhotoLibraryGalleryValue = useMemo(
    () => ({
      state: galleryState,
      photos,
      visiblePhotos,
      activePhotosByPath,
      selectedPhoto,
      openTabEntries
    }),
    [galleryState, photos, visiblePhotos, activePhotosByPath, selectedPhoto, openTabEntries]
  )

  // Own context (not part of galleryState) — progress ticks every ~150ms
  // during a scan, and publishing them through the Gallery bucket made the
  // entire visible UI re-render on each tick for the whole scan.
  const scanProgressValue: PhotoLibraryScanProgressValue = useMemo(
    () => ({
      aiScanProgress: state.aiScanProgress,
      faceScanProgress: state.faceScanProgress
    }),
    [state.aiScanProgress, state.faceScanProgress]
  )

  return (
    <PhotoLibraryActionsContext.Provider value={actions}>
      <PhotoLibrarySidebarContext.Provider value={sidebarValue}>
        <PhotoLibraryGalleryContext.Provider value={galleryValue}>
          <PhotoLibraryScanProgressContext.Provider value={scanProgressValue}>
            {children}
          </PhotoLibraryScanProgressContext.Provider>
        </PhotoLibraryGalleryContext.Provider>
      </PhotoLibrarySidebarContext.Provider>
    </PhotoLibraryActionsContext.Provider>
  )
}

// Back-compat composition of the 3 narrower hooks above, kept so every
// existing consumer keeps compiling/behaving identically while being
// migrated one area at a time — see docs/CLAUDE.md-adjacent plan notes.
// Delete once no production file imports this anymore.
// eslint-disable-next-line react-refresh/only-export-components -- context + hook are colocated by design
export function usePhotoLibrary(): PhotoLibraryContextValue {
  const actions = useLibraryActions()
  const sidebar = useSidebarLibrary()
  const gallery = useGalleryLibrary()
  return {
    ...actions,
    state: { ...sidebar.state, ...gallery.state } as PhotoLibraryComposedState,
    photos: gallery.photos,
    visiblePhotos: gallery.visiblePhotos,
    activePhotosByPath: gallery.activePhotosByPath,
    selectedPhoto: gallery.selectedPhoto,
    openTabEntries: gallery.openTabEntries,
    allTags: sidebar.allTags,
    tagCounts: sidebar.tagCounts,
    tagCoverPhotos: sidebar.tagCoverPhotos,
    tagViewCounts: sidebar.tagViewCounts,
    untaggedCount: sidebar.untaggedCount,
    folderTags: sidebar.folderTags,
    folderHasUntagged: sidebar.folderHasUntagged
  }
}
