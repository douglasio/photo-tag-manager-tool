import type { PhotoRecord, ScanCompleteEvent } from '@shared/types'
import {
  addPhotoToFolderTree,
  findRootFolder,
  isPathUnderOrEqual,
  removePhotoFromFolderTree,
  rewritePathPrefix
} from '@utils'

type ScanStatus = 'idle' | 'scanning' | 'complete' | 'canceled'

export type GallerySortBy = 'name' | 'dateTaken'
export type GallerySortOrder = 'asc' | 'desc'

export const RECENT_TAGS_LIMIT = 3

export const MAX_COMPARE_PHOTOS = 4
export const MIN_COMPARE_PHOTOS = 2

// Order-independent so opening the same set twice reuses the same tab.
export function compareTabId(paths: string[]): string {
  return `compare:${[...paths].sort().join('::')}`
}

export interface PhotoLibraryState {
  folders: string[]
  rootPath: string | null
  scanId: string | null
  status: ScanStatus
  // False until every folder's initial startup scan has resolved
  initialLoadComplete: boolean
  filesFound: number
  photosByPath: Map<string, PhotoRecord>
  cacheHits: number
  errors: ScanCompleteEvent['errors']
  selectedPath: string | null
  // Multi-select batch, kept alongside selectedPath (the "last-engaged"
  // photo for DetailPanel) rather than replacing it.
  selectedPaths: Set<string>
  selectedFolder: string | null
  selectedTag: string | null
  sortBy: GallerySortBy
  sortOrder: GallerySortOrder
  folderCounts: Map<string, number>
  folderChildren: Map<string, Set<string>>
  // Every folder on disk per watched root, including empty ones (folderCounts/
  // folderChildren above never include those). From SCAN_COMPLETE's
  // allFolders, so it's as of the last scan, not live filesystem changes.
  allFolderPaths: Set<string>
  showEmptyFolders: boolean
  detailsPanelCollapsed: boolean
  galleryAnimationsEnabled: boolean
  showFilenames: boolean
  // Global masthead/studio text for PhotoView's magazine/newspaper/DVD
  // visualizations, editable from Settings.
  magazineTitle: string
  newspaperTitle: string
  dvdStudioName: string
  excludePatterns: string[]
  tagDescriptions: Map<string, string>
  // Newest-first shortcut list for the tag-input dropdown. Session-only.
  recentTags: string[]
  // Open tab ids — photo paths or compare-tab ids (see compareTabs).
  // activeTab is 'gallery' or one of these.
  openTabs: string[]
  activeTab: string
  // Resolves a compare-tab's synthetic id (from openTabs/activeTab) to its
  // actual photo paths (MIN_COMPARE_PHOTOS to MAX_COMPARE_PHOTOS of them).
  compareTabs: Map<string, string[]>
}

export const initialState: PhotoLibraryState = {
  folders: [],
  rootPath: null,
  scanId: null,
  status: 'idle',
  initialLoadComplete: false,
  filesFound: 0,
  photosByPath: new Map(),
  cacheHits: 0,
  errors: [],
  selectedPath: null,
  selectedPaths: new Set(),
  selectedFolder: null,
  selectedTag: null,
  sortBy: 'name',
  sortOrder: 'asc',
  folderCounts: new Map(),
  folderChildren: new Map(),
  allFolderPaths: new Set(),
  showEmptyFolders: false,
  detailsPanelCollapsed: false,
  galleryAnimationsEnabled: true,
  showFilenames: true,
  magazineTitle: 'TAG ME',
  newspaperTitle: 'The Tag Me Times',
  dvdStudioName: 'TAG ME PICTURES',
  excludePatterns: [],
  tagDescriptions: new Map(),
  recentTags: [],
  openTabs: [],
  activeTab: 'gallery',
  compareTabs: new Map()
}

export type PhotoLibraryAction =
  | { type: 'FOLDERS_LOADED'; folders: string[] }
  | { type: 'FOLDER_ADDED'; folder: string }
  | { type: 'FOLDER_REMOVED'; folder: string }
  | { type: 'FOLDER_RENAMED'; oldFolder: string; newFolder: string }
  | { type: 'SCAN_STARTED'; rootPath: string; scanId: string }
  | { type: 'SCAN_PROGRESS'; filesFound: number }
  | { type: 'METADATA_BATCH'; photos: PhotoRecord[] }
  | { type: 'SCAN_COMPLETE'; result: ScanCompleteEvent }
  | { type: 'SCAN_CANCELED' }
  | { type: 'INITIAL_LOAD_COMPLETE' }
  | { type: 'SELECT_PHOTO'; path: string | null }
  | { type: 'SET_SELECTED_PATHS'; paths: string[] }
  | { type: 'PHOTOS_UPSERTED'; photos: PhotoRecord[] }
  | { type: 'SET_FOLDER_FILTER'; folder: string | null }
  | { type: 'SET_TAG_FILTER'; tag: string | null }
  | { type: 'SET_FOLDER_TAG_FILTER'; tag: string | null }
  | { type: 'SET_SORT'; sortBy: GallerySortBy; sortOrder: GallerySortOrder }
  | { type: 'SET_SHOW_EMPTY_FOLDERS'; value: boolean }
  | { type: 'SET_DETAILS_PANEL_COLLAPSED'; value: boolean }
  | { type: 'SET_GALLERY_ANIMATIONS_ENABLED'; value: boolean }
  | { type: 'SET_SHOW_FILENAMES'; value: boolean }
  | { type: 'SET_MAGAZINE_TITLE'; value: string }
  | { type: 'SET_NEWSPAPER_TITLE'; value: string }
  | { type: 'SET_DVD_STUDIO_NAME'; value: string }
  | { type: 'TAGS_ASSIGNED'; tags: string[] }
  | { type: 'SET_EXCLUDE_PATTERNS'; patterns: string[] }
  | { type: 'WATCH_FOLDER_ADDED'; folderPath: string }
  | { type: 'WATCH_FOLDER_REMOVED'; folderPath: string }
  | { type: 'PHOTO_UPSERTED'; photo: PhotoRecord }
  | { type: 'PHOTO_REMOVED'; filePath: string }
  | { type: 'TAG_DESCRIPTIONS_LOADED'; descriptions: Record<string, string> }
  | { type: 'TAG_DESCRIPTION_UPDATED'; tag: string; description: string }
  | { type: 'TAG_RENAMED'; oldTag: string; newTag: string; photos: PhotoRecord[] }
  | { type: 'TAG_DELETED'; tag: string; photos: PhotoRecord[] }
  | { type: 'OPEN_PHOTO_TAB'; filePath: string }
  | { type: 'OPEN_COMPARE_TAB'; paths: string[] }
  | { type: 'REMOVE_FROM_COMPARE_TAB'; tabId: string; filePath: string }
  | { type: 'CLOSE_PHOTO_TAB'; filePath: string }
  | { type: 'SET_ACTIVE_TAB'; tab: string }
  | { type: 'RENAME_PHOTO_TAB'; oldPath: string; newPath: string }
  | { type: 'REORDER_PHOTO_TABS'; openTabs: string[] }

// Shared by CLOSE_PHOTO_TAB and REMOVE_FROM_COMPARE_TAB (which closes its
// whole tab once too few photos remain) — falls back to the tab immediately
// left in the visible order (Gallery first, then openTabs) rather than
// always jumping to Gallery.
function closeTab(
  state: PhotoLibraryState,
  tabId: string
): Pick<PhotoLibraryState, 'openTabs' | 'activeTab'> {
  const openTabs = state.openTabs.filter((id) => id !== tabId)
  let activeTab = state.activeTab
  if (state.activeTab === tabId) {
    const order = ['gallery', ...state.openTabs]
    const closedIndex = order.indexOf(tabId)
    activeTab = order[closedIndex - 1]
  }
  return { openTabs, activeTab }
}

export function photoLibraryReducer(
  state: PhotoLibraryState,
  action: PhotoLibraryAction
): PhotoLibraryState {
  switch (action.type) {
    case 'FOLDERS_LOADED':
      return { ...state, folders: action.folders }
    case 'FOLDER_ADDED':
      if (state.folders.includes(action.folder)) return state
      return { ...state, folders: [...state.folders, action.folder] }
    case 'FOLDER_REMOVED': {
      const folders = state.folders.filter((f) => f !== action.folder)

      const photosByPath = new Map(state.photosByPath)
      for (const filePath of photosByPath.keys()) {
        if (isPathUnderOrEqual(filePath, action.folder)) photosByPath.delete(filePath)
      }

      const folderCounts = new Map(state.folderCounts)
      for (const folder of folderCounts.keys()) {
        if (isPathUnderOrEqual(folder, action.folder)) folderCounts.delete(folder)
      }
      const folderChildren = new Map(state.folderChildren)
      for (const folder of folderChildren.keys()) {
        if (isPathUnderOrEqual(folder, action.folder)) folderChildren.delete(folder)
      }

      const allFolderPaths = new Set(
        Array.from(state.allFolderPaths).filter(
          (folder) => !isPathUnderOrEqual(folder, action.folder)
        )
      )

      const selectedFolder =
        state.selectedFolder && isPathUnderOrEqual(state.selectedFolder, action.folder)
          ? null
          : state.selectedFolder
      const selectedPath =
        state.selectedPath && isPathUnderOrEqual(state.selectedPath, action.folder)
          ? null
          : state.selectedPath

      const openTabs = state.openTabs.filter((path) => !isPathUnderOrEqual(path, action.folder))
      const activeTab =
        state.activeTab !== 'gallery' && isPathUnderOrEqual(state.activeTab, action.folder)
          ? 'gallery'
          : state.activeTab

      const selectedPaths = new Set(
        Array.from(state.selectedPaths).filter((path) => !isPathUnderOrEqual(path, action.folder))
      )

      return {
        ...state,
        folders,
        photosByPath,
        folderCounts,
        folderChildren,
        allFolderPaths,
        selectedFolder,
        selectedPath,
        selectedPaths,
        openTabs,
        activeTab
      }
    }
    // Folder renamed on disk — every path-shaped bit of state needs oldFolder
    // swapped for newFolder. rewritePathPrefix no-ops on anything unrelated,
    // so it's safe to apply everywhere below.
    case 'FOLDER_RENAMED': {
      const { oldFolder, newFolder } = action
      const rewrite = (path: string): string => rewritePathPrefix(path, oldFolder, newFolder)

      const folders = state.folders.map(rewrite)

      const photosByPath = new Map<string, PhotoRecord>()
      for (const [path, photo] of state.photosByPath) {
        const newPath = rewrite(path)
        photosByPath.set(
          newPath,
          newPath === path ? photo : { ...photo, id: newPath, filePath: newPath }
        )
      }

      const folderCounts = new Map<string, number>()
      for (const [folder, count] of state.folderCounts) {
        folderCounts.set(rewrite(folder), count)
      }

      const folderChildren = new Map<string, Set<string>>()
      for (const [folder, children] of state.folderChildren) {
        folderChildren.set(rewrite(folder), new Set(Array.from(children, rewrite)))
      }

      const allFolderPaths = new Set(Array.from(state.allFolderPaths, rewrite))

      const selectedFolder = state.selectedFolder !== null ? rewrite(state.selectedFolder) : null
      const selectedPath = state.selectedPath !== null ? rewrite(state.selectedPath) : null
      const selectedPaths = new Set(Array.from(state.selectedPaths, rewrite))
      const openTabs = state.openTabs.map(rewrite)
      const activeTab = rewrite(state.activeTab)

      return {
        ...state,
        folders,
        photosByPath,
        folderCounts,
        folderChildren,
        allFolderPaths,
        selectedFolder,
        selectedPath,
        selectedPaths,
        openTabs,
        activeTab
      }
    }
    case 'SCAN_STARTED':
      return {
        ...state,
        rootPath: action.rootPath,
        scanId: action.scanId,
        status: 'scanning',
        filesFound: 0
      }
    case 'SCAN_PROGRESS':
      if (action.filesFound === state.filesFound) return state
      return { ...state, filesFound: action.filesFound }
    case 'METADATA_BATCH': {
      const photosByPath = new Map(state.photosByPath)
      const folderCounts = new Map(state.folderCounts)
      const folderChildren = new Map(state.folderChildren)
      for (const photo of action.photos) {
        if (state.rootPath && !photosByPath.has(photo.filePath)) {
          addPhotoToFolderTree(photo.filePath, state.rootPath, folderCounts, folderChildren)
        }
        photosByPath.set(photo.filePath, photo)
      }
      return { ...state, photosByPath, folderCounts, folderChildren }
    }
    // filePaths (null if the scan aborted before finishing) is authoritative
    // for what exists under rootPath. METADATA_BATCH already added new
    // finds; this prunes anything previously known that's now missing,
    // mirroring the main process's own pruneMissing.
    case 'SCAN_COMPLETE': {
      const { rootPath, filePaths, allFolders } = action.result

      let photosByPath = state.photosByPath
      let folderCounts = state.folderCounts
      let folderChildren = state.folderChildren
      let allFolderPaths = state.allFolderPaths
      let selectedPath = state.selectedPath
      let selectedPaths = state.selectedPaths
      let openTabs = state.openTabs
      let activeTab = state.activeTab

      if (filePaths) {
        const keep = new Set(filePaths)
        const stale = Array.from(photosByPath.keys()).filter(
          (path) => isPathUnderOrEqual(path, rootPath) && !keep.has(path)
        )
        if (stale.length > 0) {
          photosByPath = new Map(photosByPath)
          folderCounts = new Map(folderCounts)
          folderChildren = new Map(folderChildren)
          for (const filePath of stale) {
            photosByPath.delete(filePath)
            removePhotoFromFolderTree(filePath, rootPath, folderCounts, folderChildren)
          }

          const staleSet = new Set(stale)
          selectedPath = selectedPath && staleSet.has(selectedPath) ? null : selectedPath
          selectedPaths = new Set(Array.from(selectedPaths).filter((path) => !staleSet.has(path)))
          openTabs = openTabs.filter((path) => !staleSet.has(path))
          activeTab = staleSet.has(activeTab) ? 'gallery' : activeTab
        }

        // Replaces this root's folder listing rather than only adding to it.
        const keptFolders = Array.from(allFolderPaths).filter(
          (folder) => !isPathUnderOrEqual(folder, rootPath)
        )
        allFolderPaths = new Set([...keptFolders, ...allFolders])
      } else {
        allFolderPaths = new Set(allFolderPaths)
        for (const folder of allFolders) allFolderPaths.add(folder)
      }

      return {
        ...state,
        status: 'complete',
        cacheHits: state.cacheHits + action.result.cacheHits,
        errors: [...state.errors, ...action.result.errors],
        photosByPath,
        folderCounts,
        folderChildren,
        allFolderPaths,
        selectedPath,
        selectedPaths,
        openTabs,
        activeTab
      }
    }
    case 'SCAN_CANCELED':
      return { ...state, status: 'canceled' }
    case 'INITIAL_LOAD_COMPLETE':
      return { ...state, initialLoadComplete: true }
    case 'SELECT_PHOTO':
      return { ...state, selectedPath: action.path }
    case 'SET_SELECTED_PATHS':
      return { ...state, selectedPaths: new Set(action.paths) }
    case 'PHOTOS_UPSERTED': {
      const photosByPath = new Map(state.photosByPath)
      for (const photo of action.photos) {
        photosByPath.set(photo.filePath, photo)
      }
      return { ...state, photosByPath }
    }
    case 'SET_FOLDER_FILTER':
      return { ...state, selectedFolder: action.folder, selectedTag: null }
    case 'SET_TAG_FILTER':
      return { ...state, selectedTag: action.tag, selectedFolder: null }
    // Unlike SET_TAG_FILTER, keeps selectedFolder intact — for the
    // per-folder tag pills that narrow within a folder rather than replace it.
    case 'SET_FOLDER_TAG_FILTER':
      return { ...state, selectedTag: action.tag }
    case 'SET_SORT':
      return { ...state, sortBy: action.sortBy, sortOrder: action.sortOrder }
    case 'SET_SHOW_EMPTY_FOLDERS':
      return { ...state, showEmptyFolders: action.value }
    case 'SET_DETAILS_PANEL_COLLAPSED':
      return { ...state, detailsPanelCollapsed: action.value }
    case 'SET_GALLERY_ANIMATIONS_ENABLED':
      return { ...state, galleryAnimationsEnabled: action.value }
    case 'SET_SHOW_FILENAMES':
      return { ...state, showFilenames: action.value }
    case 'SET_MAGAZINE_TITLE':
      return { ...state, magazineTitle: action.value }
    case 'SET_NEWSPAPER_TITLE':
      return { ...state, newspaperTitle: action.value }
    case 'SET_DVD_STUDIO_NAME':
      return { ...state, dvdStudioName: action.value }
    // Newest-first, deduped, capped — an already-listed tag moves to the
    // front instead of duplicating.
    case 'TAGS_ASSIGNED': {
      const incoming = Array.from(new Set(action.tags))
      if (incoming.length === 0) return state
      const recentTags = [
        ...incoming,
        ...state.recentTags.filter((tag) => !incoming.includes(tag))
      ].slice(0, RECENT_TAGS_LIMIT)
      return { ...state, recentTags }
    }
    case 'SET_EXCLUDE_PATTERNS':
      return { ...state, excludePatterns: action.patterns }
    case 'WATCH_FOLDER_ADDED': {
      if (state.allFolderPaths.has(action.folderPath)) return state
      const allFolderPaths = new Set(state.allFolderPaths)
      allFolderPaths.add(action.folderPath)
      return { ...state, allFolderPaths }
    }
    // Prunes the folder and everything nested under it — a no-op once
    // chokidar's per-level unlinkDir follow-ups arrive.
    case 'WATCH_FOLDER_REMOVED': {
      const allFolderPaths = new Set(
        Array.from(state.allFolderPaths).filter(
          (folder) => !isPathUnderOrEqual(folder, action.folderPath)
        )
      )
      return { ...state, allFolderPaths }
    }
    case 'PHOTO_UPSERTED': {
      const rootFolder = findRootFolder(action.photo.filePath, state.folders)
      const photosByPath = new Map(state.photosByPath)
      const folderCounts = new Map(state.folderCounts)
      const folderChildren = new Map(state.folderChildren)
      if (rootFolder && !photosByPath.has(action.photo.filePath)) {
        addPhotoToFolderTree(action.photo.filePath, rootFolder, folderCounts, folderChildren)
      }
      photosByPath.set(action.photo.filePath, action.photo)
      return { ...state, photosByPath, folderCounts, folderChildren }
    }
    case 'PHOTO_REMOVED': {
      if (!state.photosByPath.has(action.filePath)) return state

      const rootFolder = findRootFolder(action.filePath, state.folders)
      const photosByPath = new Map(state.photosByPath)
      photosByPath.delete(action.filePath)
      const folderCounts = new Map(state.folderCounts)
      const folderChildren = new Map(state.folderChildren)
      if (rootFolder) {
        removePhotoFromFolderTree(action.filePath, rootFolder, folderCounts, folderChildren)
      }
      const selectedPath = state.selectedPath === action.filePath ? null : state.selectedPath
      const selectedPaths = state.selectedPaths.has(action.filePath)
        ? new Set(Array.from(state.selectedPaths).filter((path) => path !== action.filePath))
        : state.selectedPaths
      const openTabs = state.openTabs.filter((path) => path !== action.filePath)
      const activeTab = state.activeTab === action.filePath ? 'gallery' : state.activeTab

      return {
        ...state,
        photosByPath,
        folderCounts,
        folderChildren,
        selectedPath,
        selectedPaths,
        openTabs,
        activeTab
      }
    }
    case 'TAG_DESCRIPTIONS_LOADED':
      return { ...state, tagDescriptions: new Map(Object.entries(action.descriptions)) }
    case 'TAG_DESCRIPTION_UPDATED': {
      const tagDescriptions = new Map(state.tagDescriptions)
      if (action.description.trim() === '') {
        tagDescriptions.delete(action.tag)
      } else {
        tagDescriptions.set(action.tag, action.description)
      }
      return { ...state, tagDescriptions }
    }
    case 'TAG_RENAMED': {
      const photosByPath = new Map(state.photosByPath)
      for (const photo of action.photos) {
        photosByPath.set(photo.filePath, photo)
      }

      const tagDescriptions = new Map(state.tagDescriptions)
      const movedDescription = tagDescriptions.get(action.oldTag)
      tagDescriptions.delete(action.oldTag)
      if (movedDescription) tagDescriptions.set(action.newTag, movedDescription)

      const selectedTag = state.selectedTag === action.oldTag ? action.newTag : state.selectedTag

      return { ...state, photosByPath, tagDescriptions, selectedTag }
    }
    case 'TAG_DELETED': {
      const photosByPath = new Map(state.photosByPath)
      for (const photo of action.photos) {
        photosByPath.set(photo.filePath, photo)
      }

      const tagDescriptions = new Map(state.tagDescriptions)
      tagDescriptions.delete(action.tag)

      const selectedTag = state.selectedTag === action.tag ? null : state.selectedTag

      return { ...state, photosByPath, tagDescriptions, selectedTag }
    }
    case 'OPEN_PHOTO_TAB': {
      const openTabs = state.openTabs.includes(action.filePath)
        ? state.openTabs
        : [...state.openTabs, action.filePath]
      return { ...state, openTabs, activeTab: action.filePath }
    }
    case 'OPEN_COMPARE_TAB': {
      // Deduped and capped defensively — callers are expected to already
      // enforce MIN/MAX_COMPARE_PHOTOS, but the reducer shouldn't trust that.
      const paths = Array.from(new Set(action.paths)).slice(0, MAX_COMPARE_PHOTOS)
      const id = compareTabId(paths)
      const openTabs = state.openTabs.includes(id) ? state.openTabs : [...state.openTabs, id]
      const compareTabs = new Map(state.compareTabs)
      compareTabs.set(id, paths)
      return { ...state, openTabs, activeTab: id, compareTabs }
    }
    // Drops one photo from an open compare tab, closing the whole tab
    // instead once fewer than MIN_COMPARE_PHOTOS would remain.
    case 'REMOVE_FROM_COMPARE_TAB': {
      const current = state.compareTabs.get(action.tabId)
      if (!current || !current.includes(action.filePath)) return state
      const remaining = current.filter((path) => path !== action.filePath)
      if (remaining.length < MIN_COMPARE_PHOTOS) {
        const { openTabs, activeTab } = closeTab(state, action.tabId)
        const compareTabs = new Map(state.compareTabs)
        compareTabs.delete(action.tabId)
        return { ...state, openTabs, activeTab, compareTabs }
      }
      const compareTabs = new Map(state.compareTabs)
      compareTabs.set(action.tabId, remaining)
      return { ...state, compareTabs }
    }
    case 'CLOSE_PHOTO_TAB': {
      if (!state.openTabs.includes(action.filePath)) return state
      const { openTabs, activeTab } = closeTab(state, action.filePath)
      let compareTabs = state.compareTabs
      if (compareTabs.has(action.filePath)) {
        compareTabs = new Map(compareTabs)
        compareTabs.delete(action.filePath)
      }
      return { ...state, openTabs, activeTab, compareTabs }
    }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab }
    // Repoints a renamed photo's tab (and active-tab pointer) at its new
    // path, instead of letting PHOTO_REMOVED prune it as if deleted.
    case 'RENAME_PHOTO_TAB': {
      if (!state.openTabs.includes(action.oldPath)) return state
      // newPath may already be open elsewhere (e.g. arrow-key navigation
      // landing on it) — drop that occurrence instead of duplicating the tab.
      const openTabs = state.openTabs
        .filter((path) => path === action.oldPath || path !== action.newPath)
        .map((path) => (path === action.oldPath ? action.newPath : path))
      const activeTab = state.activeTab === action.oldPath ? action.newPath : state.activeTab
      return { ...state, openTabs, activeTab }
    }
    case 'REORDER_PHOTO_TABS':
      return { ...state, openTabs: action.openTabs }
    default:
      return state
  }
}
