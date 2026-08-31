import type {
  AiScanProgress,
  AppSettings,
  DefaultView,
  EmbeddingIndexProgress,
  FaceIndexProgress,
  FaceScanProgress,
  GalleryViewMode,
  PersonRecord,
  PhotoRecord,
  ScanCompleteEvent,
  ScanPhase,
  TagGroup
} from '@shared/types'
import {
  addPhotoToFolderTree,
  findRootFolder,
  isPathUnderOrEqual,
  removePhotoFromFolderTree,
  rewritePathPrefix
} from '@utils'

export type ScanStatus = 'idle' | 'scanning' | 'complete' | 'canceled'

export type GallerySortBy = 'name' | 'dateTaken' | 'viewCount' | 'random'
export type GallerySortOrder = 'asc' | 'desc'

export const RECENT_TAGS_LIMIT = 3

export const MAX_COMPARE_PHOTOS = 4
export const MIN_COMPARE_PHOTOS = 2

// Sidebar width bounds. The minimum keeps the folder tree's own indentation
// plus row controls usable; the maximum stops the sidebar from crowding out
// the gallery on smaller windows.
export const DEFAULT_NAVBAR_WIDTH = 300
export const MIN_NAVBAR_WIDTH = 200
export const MAX_NAVBAR_WIDTH = 600

export function clampNavbarWidth(width: number): number {
  return Math.min(MAX_NAVBAR_WIDTH, Math.max(MIN_NAVBAR_WIDTH, Math.round(width)))
}

// Gallery thumbnail size. The maximum stays under thumbnailService's
// THUMBNAIL_LONG_EDGE (640px) so cells never upscale past the cached
// thumbnail. Lives here rather than in useGalleryGridLayout so the reducer
// can clamp a persisted value on load, same as the navbar width above.
export const DEFAULT_CELL_WIDTH = 168
export const MIN_CELL_WIDTH = 100
export const MAX_CELL_WIDTH = 600

export function clampCellWidth(width: number): number {
  return Math.min(MAX_CELL_WIDTH, Math.max(MIN_CELL_WIDTH, width))
}

// Order-independent so opening the same set twice reuses the same tab.
export function compareTabId(paths: string[]): string {
  return `compare:${[...paths].sort().join('::')}`
}

export interface PhotoLibraryState {
  folders: string[]
  scanId: string | null
  status: ScanStatus
  // False until every folder's initial startup scan has resolved
  initialLoadComplete: boolean
  // Session-only, null when idle — lives here (not galleryState) for the same
  // reason as aiScanProgress/faceScanProgress: publishing a running counter
  // through the high-churn gallery bucket would re-render the entire visible
  // UI on every ~150ms tick. See PhotoLibraryScanProgressContext.
  photoScanProgress: { phase: ScanPhase; done: number; total: number } | null
  photosByPath: Map<string, PhotoRecord>
  cacheHits: number
  errors: ScanCompleteEvent['errors']
  selectedPath: string | null
  // Multi-select batch, kept alongside selectedPath (the "last-engaged"
  // photo for DetailPanel) rather than replacing it.
  selectedPaths: Set<string>
  selectedFolder: string | null
  selectedTag: string | null
  selectedPerson: string | null
  // An active search filtering the gallery, from Spotlight's "show all in
  // Gallery". Holds the matched paths rather than the query, so the grid
  // filters without re-running the search on every render.
  searchResults: { paths: Set<string>; label: string } | null
  // Every (photo, person) pairing, keyed by personId — lets the gallery filter
  // by person synchronously, same as tags (which live directly on PhotoRecord).
  personPhotoAssignments: Map<string, Set<string>>
  // Pseudo-filter for untagged photos — separate flag rather than a sentinel
  // on selectedTag, since a real tag name could otherwise collide with it.
  untaggedFilterActive: boolean
  sortBy: GallerySortBy
  sortOrder: GallerySortOrder
  folderCounts: Map<string, number>
  folderChildren: Map<string, Set<string>>
  // Every folder on disk per watched root, including empty ones (unlike
  // folderCounts/folderChildren) — as of the last scan, not live changes.
  allFolderPaths: Set<string>
  // Which pinned tab ('dashboard' or 'gallery') the app loads into on launch.
  defaultView: DefaultView
  showEmptyFolders: boolean
  tagsPanelGridView: boolean
  peoplePanelGridView: boolean
  galleryViewMode: GalleryViewMode
  aiTagSuggestionsEnabled: boolean
  // Session-only — null when no AI scan is in flight. Spans the whole
  // download/embed/cluster flow, regardless of which component triggered it.
  aiScanProgress: AiScanProgress | null
  // Session-only — null when the background embedding indexer is idle. Ambient
  // rather than tied to a single user-triggered request (see
  // embeddingIndexService), so it's seeded from a status query on mount
  // rather than only ever set by a request's own response.
  embeddingIndexProgress: EmbeddingIndexProgress | null
  faceDetectionEnabled: boolean
  // Session-only, same reasoning as aiScanProgress — spans the whole
  // detect-then-cluster face scan regardless of which component triggered it.
  faceScanProgress: FaceScanProgress | null
  // Session-only — null when the background face indexer is idle. Ambient
  // rather than tied to a user-triggered request, same as
  // embeddingIndexProgress.
  faceIndexProgress: FaceIndexProgress | null
  // People (labeled/unlabeled face clusters) — loaded once face detection is
  // enabled and refreshed after any scan or manual assign/merge/split.
  people: PersonRecord[]
  // Session-only — lets other components (e.g. onboarding checklists) open
  // the Settings modal without a ref/portal into its own local state.
  settingsModalOpened: boolean
  detailsPanelCollapsed: boolean
  galleryAnimationsEnabled: boolean
  showFilenames: boolean
  showViewCounts: boolean
  // Percentage split of the navbar's Splitter panes — [tags, people, folders]
  // when People is shown, [tags, folders] otherwise; App.tsx defaults on mismatch.
  navbarSplitSizes: number[]
  // The sidebar's overall width in px, distinct from navbarSplitSizes above
  // (which only divides the panes within it). Drives AppShell's navbar width.
  navbarWidth: number
  // Target thumbnail width for the gallery grid. Holds the committed value
  // only — the live value during a slider drag stays local to
  // useGalleryGridLayout, so dragging doesn't re-render every context consumer.
  galleryCellWidth: number
  // Accordion-style collapse for the same panes, keyed by a stable panel id
  // ('tags' | 'people' | 'folders') rather than index — missing key means expanded.
  navbarCollapsedPanels: Record<string, boolean>
  // Global masthead/studio text for PhotoView's magazine/newspaper/DVD
  // visualizations, editable from Settings.
  magazineTitle: string
  newspaperTitle: string
  dvdStudioName: string
  artGalleryName: string
  excludePatterns: string[]
  // Folders excluded from tags/AI/duplicates/Time Warp/dashboard aggregates —
  // still fully ingested and browsable directly, just filtered from those.
  excludedFolders: string[]
  tagDescriptions: Map<string, string>
  // User-defined tag groups (TagPanel's accordion view) — a tag missing from
  // tagGroupAssignments below is ungrouped ("Other Tags").
  tagGroups: TagGroup[]
  tagGroupAssignments: Map<string, string>
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
  scanId: null,
  status: 'idle',
  initialLoadComplete: false,
  photoScanProgress: null,
  photosByPath: new Map(),
  cacheHits: 0,
  errors: [],
  selectedPath: null,
  selectedPaths: new Set(),
  selectedFolder: null,
  selectedTag: null,
  selectedPerson: null,
  searchResults: null,
  personPhotoAssignments: new Map(),
  untaggedFilterActive: false,
  sortBy: 'name',
  sortOrder: 'asc',
  folderCounts: new Map(),
  folderChildren: new Map(),
  allFolderPaths: new Set(),
  defaultView: 'dashboard',
  showEmptyFolders: false,
  tagsPanelGridView: false,
  peoplePanelGridView: false,
  galleryViewMode: 'grid',
  aiTagSuggestionsEnabled: false,
  aiScanProgress: null,
  embeddingIndexProgress: null,
  faceDetectionEnabled: false,
  faceScanProgress: null,
  faceIndexProgress: null,
  people: [],
  settingsModalOpened: false,
  detailsPanelCollapsed: false,
  galleryAnimationsEnabled: true,
  showFilenames: true,
  showViewCounts: false,
  navbarSplitSizes: [50, 50],
  navbarWidth: DEFAULT_NAVBAR_WIDTH,
  galleryCellWidth: DEFAULT_CELL_WIDTH,
  navbarCollapsedPanels: {},
  magazineTitle: 'TAG ME',
  newspaperTitle: 'The Tag Me Times',
  dvdStudioName: 'TAG ME PICTURES',
  artGalleryName: 'The Tag Me Gallery',
  excludePatterns: [],
  excludedFolders: [],
  tagDescriptions: new Map(),
  tagGroups: [],
  tagGroupAssignments: new Map(),
  recentTags: [],
  openTabs: [],
  activeTab: 'dashboard',
  compareTabs: new Map()
}

export type PhotoLibraryAction =
  | { type: 'FOLDERS_LOADED'; folders: string[] }
  | { type: 'SETTINGS_LOADED'; settings: AppSettings }
  | { type: 'FOLDER_ADDED'; folder: string }
  | { type: 'FOLDER_REMOVED'; folder: string }
  | { type: 'FOLDER_RENAMED'; oldFolder: string; newFolder: string }
  | { type: 'SCAN_STARTED'; scanId: string }
  | { type: 'SCAN_PROGRESS'; phase: ScanPhase; done: number; total: number }
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
  | { type: 'SET_UNTAGGED_FILTER'; active: boolean }
  | { type: 'SET_FOLDER_UNTAGGED_FILTER'; active: boolean }
  | { type: 'SET_PERSON_FILTER'; personId: string | null }
  | { type: 'SET_PERSON_PHOTO_ASSIGNMENTS'; assignments: Map<string, Set<string>> }
  | { type: 'SET_SORT'; sortBy: GallerySortBy; sortOrder: GallerySortOrder }
  | { type: 'SET_DEFAULT_VIEW'; value: DefaultView }
  | { type: 'SET_SHOW_EMPTY_FOLDERS'; value: boolean }
  | { type: 'SET_TAGS_PANEL_GRID_VIEW'; value: boolean }
  | { type: 'SET_PEOPLE_PANEL_GRID_VIEW'; value: boolean }
  | { type: 'SET_GALLERY_VIEW_MODE'; value: GalleryViewMode }
  | { type: 'SET_AI_TAG_SUGGESTIONS_ENABLED'; value: boolean }
  | { type: 'SET_AI_SCAN_PROGRESS'; progress: AiScanProgress | null }
  | { type: 'SET_EMBEDDING_INDEX_PROGRESS'; progress: EmbeddingIndexProgress | null }
  | { type: 'SET_FACE_DETECTION_ENABLED'; value: boolean }
  | { type: 'SET_FACE_SCAN_PROGRESS'; progress: FaceScanProgress | null }
  | { type: 'SET_FACE_INDEX_PROGRESS'; progress: FaceIndexProgress | null }
  | { type: 'SET_PEOPLE'; people: PersonRecord[] }
  | { type: 'SET_SETTINGS_MODAL_OPENED'; value: boolean }
  | { type: 'SET_DETAILS_PANEL_COLLAPSED'; value: boolean }
  | { type: 'SET_GALLERY_ANIMATIONS_ENABLED'; value: boolean }
  | { type: 'SET_SHOW_FILENAMES'; value: boolean }
  | { type: 'SET_SHOW_VIEW_COUNTS'; value: boolean }
  | { type: 'SET_NAVBAR_SPLIT_SIZES'; sizes: number[] }
  | { type: 'SET_NAVBAR_WIDTH'; width: number }
  | { type: 'SET_GALLERY_CELL_WIDTH'; width: number }
  | { type: 'SET_SEARCH_RESULTS'; paths: string[]; label: string }
  | { type: 'CLEAR_SEARCH_RESULTS' }
  | { type: 'SET_NAVBAR_COLLAPSED_PANELS'; panels: Record<string, boolean> }
  | { type: 'SET_MAGAZINE_TITLE'; value: string }
  | { type: 'SET_NEWSPAPER_TITLE'; value: string }
  | { type: 'SET_DVD_STUDIO_NAME'; value: string }
  | { type: 'SET_ART_GALLERY_NAME'; value: string }
  | { type: 'TAGS_ASSIGNED'; tags: string[] }
  | { type: 'SET_EXCLUDE_PATTERNS'; patterns: string[] }
  | { type: 'SET_EXCLUDED_FOLDERS'; folders: string[] }
  | { type: 'WATCH_FOLDER_ADDED'; folderPath: string }
  | { type: 'WATCH_FOLDER_REMOVED'; folderPath: string }
  | { type: 'PHOTO_UPSERTED'; photo: PhotoRecord }
  | { type: 'PHOTO_REMOVED'; filePath: string }
  | { type: 'TAG_DESCRIPTIONS_LOADED'; descriptions: Record<string, string> }
  | { type: 'TAG_DESCRIPTION_UPDATED'; tag: string; description: string }
  | { type: 'TAG_RENAMED'; oldTag: string; newTag: string; photos: PhotoRecord[] }
  | { type: 'TAG_DELETED'; tag: string; photos: PhotoRecord[] }
  | {
      type: 'TAG_GROUPS_DATA_LOADED'
      groups: TagGroup[]
      assignments: Record<string, string>
    }
  | { type: 'TAG_GROUP_CREATED'; group: TagGroup }
  | { type: 'TAG_GROUP_RENAMED'; id: string; name: string }
  | { type: 'TAG_GROUP_MATCH_PATTERN_UPDATED'; id: string; matchPattern: string | null }
  | { type: 'TAG_GROUP_DELETED'; id: string }
  | { type: 'TAG_GROUP_ASSIGNMENT_CHANGED'; tag: string; groupId: string | null }
  | { type: 'OPEN_PHOTO_TAB'; filePath: string }
  | { type: 'OPEN_COMPARE_TAB'; paths: string[] }
  | { type: 'REMOVE_FROM_COMPARE_TAB'; tabId: string; filePath: string }
  | { type: 'CLOSE_PHOTO_TAB'; filePath: string }
  | { type: 'CLOSE_ALL_TABS' }
  | { type: 'SET_ACTIVE_TAB'; tab: string }
  | { type: 'RENAME_PHOTO_TAB'; oldPath: string; newPath: string }
  | { type: 'REORDER_PHOTO_TABS'; openTabs: string[] }
  | { type: 'OPEN_DUPLICATES_TAB' }

// Shared by CLOSE_PHOTO_TAB and REMOVE_FROM_COMPARE_TAB — falls back to the
// tab immediately left in visible order, rather than always jumping to Gallery.
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
    // Batched startup settings load — gallerySort/navbarSplitSizes only
    // override when persisted (non-null), same as SET_SORT/SET_NAVBAR_SPLIT_SIZES.
    case 'SETTINGS_LOADED': {
      const { gallerySort, navbarSplitSizes, navbarWidth, galleryCellWidth, ...rest } =
        action.settings
      return {
        ...state,
        ...rest,
        ...(gallerySort ? { sortBy: gallerySort.sortBy, sortOrder: gallerySort.sortOrder } : {}),
        ...(navbarSplitSizes ? { navbarSplitSizes } : {}),
        ...(navbarWidth ? { navbarWidth: clampNavbarWidth(navbarWidth) } : {}),
        ...(galleryCellWidth ? { galleryCellWidth: clampCellWidth(galleryCellWidth) } : {})
      }
    }
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
    // Folder renamed on disk — rewritePathPrefix no-ops on anything unrelated,
    // so it's safe to apply to every path-shaped bit of state below.
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
      const searchResults = state.searchResults
        ? { ...state.searchResults, paths: new Set(Array.from(state.searchResults.paths, rewrite)) }
        : null

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
        activeTab,
        searchResults
      }
    }
    case 'SCAN_STARTED':
      return {
        ...state,
        scanId: action.scanId,
        status: 'scanning',
        photoScanProgress: null
      }
    case 'SCAN_PROGRESS': {
      const current = state.photoScanProgress
      if (
        current &&
        current.phase === action.phase &&
        current.done === action.done &&
        current.total === action.total
      ) {
        return state
      }
      return {
        ...state,
        photoScanProgress: { phase: action.phase, done: action.done, total: action.total }
      }
    }
    case 'METADATA_BATCH': {
      const photosByPath = new Map(state.photosByPath)
      const folderCounts = new Map(state.folderCounts)
      const folderChildren = new Map(state.folderChildren)
      for (const photo of action.photos) {
        if (!photosByPath.has(photo.filePath)) {
          // Looked up per photo (not a single "currently scanning" root) —
          // a combined scan across every watched folder interleaves photos
          // from all of them in the same batch.
          const owningRoot = state.folders.find((folder) =>
            isPathUnderOrEqual(photo.filePath, folder)
          )
          if (owningRoot)
            addPhotoToFolderTree(photo.filePath, owningRoot, folderCounts, folderChildren)
        }
        photosByPath.set(photo.filePath, photo)
      }
      return { ...state, photosByPath, folderCounts, folderChildren }
    }
    // filePaths (null if the scan aborted) is authoritative for what exists
    // under rootPaths — prunes anything previously known that's now missing.
    case 'SCAN_COMPLETE': {
      const { rootPaths, filePaths, allFolders } = action.result
      const isUnderAnyRoot = (path: string): boolean =>
        rootPaths.some((root) => isPathUnderOrEqual(path, root))

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
          (path) => isUnderAnyRoot(path) && !keep.has(path)
        )
        if (stale.length > 0) {
          photosByPath = new Map(photosByPath)
          folderCounts = new Map(folderCounts)
          folderChildren = new Map(folderChildren)
          for (const filePath of stale) {
            photosByPath.delete(filePath)
            const owningRoot = rootPaths.find((root) => isPathUnderOrEqual(filePath, root))
            if (owningRoot)
              removePhotoFromFolderTree(filePath, owningRoot, folderCounts, folderChildren)
          }

          const staleSet = new Set(stale)
          selectedPath = selectedPath && staleSet.has(selectedPath) ? null : selectedPath
          selectedPaths = new Set(Array.from(selectedPaths).filter((path) => !staleSet.has(path)))
          openTabs = openTabs.filter((path) => !staleSet.has(path))
          activeTab = staleSet.has(activeTab) ? 'gallery' : activeTab
        }

        // Replaces these roots' folder listings rather than only adding to them.
        const keptFolders = Array.from(allFolderPaths).filter((folder) => !isUnderAnyRoot(folder))
        allFolderPaths = new Set([...keptFolders, ...allFolders])
      } else {
        allFolderPaths = new Set(allFolderPaths)
        for (const folder of allFolders) allFolderPaths.add(folder)
      }

      return {
        ...state,
        status: 'complete',
        photoScanProgress: null,
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
      return { ...state, status: 'canceled', photoScanProgress: null }
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
      return {
        ...state,
        selectedFolder: action.folder,
        selectedTag: null,
        selectedPerson: null,
        untaggedFilterActive: false,
        searchResults: null
      }
    case 'SET_TAG_FILTER':
      return {
        ...state,
        selectedTag: action.tag,
        selectedFolder: null,
        selectedPerson: null,
        untaggedFilterActive: false,
        searchResults: null
      }
    // Unlike SET_TAG_FILTER, keeps selectedFolder intact — for the
    // per-folder tag pills that narrow within a folder rather than replace it.
    case 'SET_FOLDER_TAG_FILTER':
      return {
        ...state,
        selectedTag: action.tag,
        selectedPerson: null,
        untaggedFilterActive: false
      }
    case 'SET_UNTAGGED_FILTER':
      return {
        ...state,
        untaggedFilterActive: action.active,
        selectedTag: null,
        selectedFolder: null,
        selectedPerson: null,
        searchResults: null
      }
    // Search behaves as another primary filter: it replaces folder/tag/person
    // (and they replace it, above), rather than stacking with them.
    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        searchResults: { paths: new Set(action.paths), label: action.label },
        selectedTag: null,
        selectedFolder: null,
        selectedPerson: null,
        untaggedFilterActive: false
      }
    case 'CLEAR_SEARCH_RESULTS':
      return { ...state, searchResults: null }
    // Like SET_FOLDER_TAG_FILTER, keeps selectedFolder intact — the folder
    // pill row's own "Untagged" entry narrows within the folder rather than
    // replacing it with the global (folder-agnostic) untagged view.
    case 'SET_FOLDER_UNTAGGED_FILTER':
      return {
        ...state,
        untaggedFilterActive: action.active,
        selectedTag: null,
        selectedPerson: null
      }
    // Global (folder-agnostic), same as SET_TAG_FILTER — selecting a person
    // in PeoplePanel replaces whatever other filter was active rather than
    // stacking, keeping "one primary filter at a time" consistent with tags.
    case 'SET_PERSON_FILTER':
      return {
        ...state,
        selectedPerson: action.personId,
        selectedFolder: null,
        selectedTag: null,
        untaggedFilterActive: false,
        searchResults: null
      }
    case 'SET_PERSON_PHOTO_ASSIGNMENTS':
      return { ...state, personPhotoAssignments: action.assignments }
    case 'SET_SORT':
      return { ...state, sortBy: action.sortBy, sortOrder: action.sortOrder }
    case 'SET_DEFAULT_VIEW':
      return { ...state, defaultView: action.value }
    case 'SET_SHOW_EMPTY_FOLDERS':
      return { ...state, showEmptyFolders: action.value }
    case 'SET_TAGS_PANEL_GRID_VIEW':
      return { ...state, tagsPanelGridView: action.value }
    case 'SET_PEOPLE_PANEL_GRID_VIEW':
      return { ...state, peoplePanelGridView: action.value }
    case 'SET_GALLERY_VIEW_MODE':
      return { ...state, galleryViewMode: action.value }
    case 'SET_AI_TAG_SUGGESTIONS_ENABLED':
      // Guarded (unlike most setters here) because runAiScan dispatches this
      // on every throttled progress tick once embedding starts, not just once.
      return state.aiTagSuggestionsEnabled === action.value
        ? state
        : { ...state, aiTagSuggestionsEnabled: action.value }
    case 'SET_AI_SCAN_PROGRESS':
      return { ...state, aiScanProgress: action.progress }
    case 'SET_EMBEDDING_INDEX_PROGRESS':
      return { ...state, embeddingIndexProgress: action.progress }
    case 'SET_FACE_DETECTION_ENABLED':
      // Guarded for the same reason as SET_AI_TAG_SUGGESTIONS_ENABLED above.
      if (state.faceDetectionEnabled === action.value) return state
      // Disabling is a full reset on the backend (clearAllFaceData) — clear
      // the local mirror of that data too, rather than leaving stale people/
      // assignments/filter around until the next reload.
      return action.value
        ? { ...state, faceDetectionEnabled: true }
        : {
            ...state,
            faceDetectionEnabled: false,
            people: [],
            personPhotoAssignments: new Map(),
            selectedPerson: null
          }
    case 'SET_FACE_SCAN_PROGRESS':
      return { ...state, faceScanProgress: action.progress }
    case 'SET_FACE_INDEX_PROGRESS':
      return { ...state, faceIndexProgress: action.progress }
    case 'SET_PEOPLE':
      return { ...state, people: action.people }
    case 'SET_SETTINGS_MODAL_OPENED':
      return { ...state, settingsModalOpened: action.value }
    case 'SET_DETAILS_PANEL_COLLAPSED':
      return { ...state, detailsPanelCollapsed: action.value }
    case 'SET_GALLERY_ANIMATIONS_ENABLED':
      return { ...state, galleryAnimationsEnabled: action.value }
    case 'SET_SHOW_FILENAMES':
      return { ...state, showFilenames: action.value }
    case 'SET_SHOW_VIEW_COUNTS':
      return { ...state, showViewCounts: action.value }
    case 'SET_NAVBAR_SPLIT_SIZES':
      return { ...state, navbarSplitSizes: action.sizes }
    case 'SET_NAVBAR_WIDTH':
      return { ...state, navbarWidth: clampNavbarWidth(action.width) }
    case 'SET_GALLERY_CELL_WIDTH':
      return { ...state, galleryCellWidth: clampCellWidth(action.width) }
    case 'SET_NAVBAR_COLLAPSED_PANELS':
      return { ...state, navbarCollapsedPanels: action.panels }
    case 'SET_MAGAZINE_TITLE':
      return { ...state, magazineTitle: action.value }
    case 'SET_NEWSPAPER_TITLE':
      return { ...state, newspaperTitle: action.value }
    case 'SET_DVD_STUDIO_NAME':
      return { ...state, dvdStudioName: action.value }
    case 'SET_ART_GALLERY_NAME':
      return { ...state, artGalleryName: action.value }
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
    case 'SET_EXCLUDED_FOLDERS':
      return { ...state, excludedFolders: action.folders }
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
      const isNewPhoto = !state.photosByPath.has(action.photo.filePath)
      const photosByPath = new Map(state.photosByPath)
      photosByPath.set(action.photo.filePath, action.photo)

      // Only copy+rebuild the folder tree when a photo is genuinely new to
      // it — an existing photo's write (tags, comment, viewCount, rotate,
      // ...) never changes folder membership, so giving folderCounts/
      // folderChildren a new identity on every such write was forcing
      // FolderTree to rebuild+rerender its whole tree for no reason.
      let folderCounts = state.folderCounts
      let folderChildren = state.folderChildren
      if (isNewPhoto) {
        const rootFolder = findRootFolder(action.photo.filePath, state.folders)
        if (rootFolder) {
          folderCounts = new Map(state.folderCounts)
          folderChildren = new Map(state.folderChildren)
          addPhotoToFolderTree(action.photo.filePath, rootFolder, folderCounts, folderChildren)
        }
      }
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

      // Carries group membership across the rename — a rename otherwise looks
      // identical to "old tag gone, new tag appeared" (mirrors renameTagMetadata).
      const tagGroupAssignments = new Map(state.tagGroupAssignments)
      const movedGroupId = tagGroupAssignments.get(action.oldTag)
      tagGroupAssignments.delete(action.oldTag)
      if (movedGroupId) tagGroupAssignments.set(action.newTag, movedGroupId)

      const selectedTag = state.selectedTag === action.oldTag ? action.newTag : state.selectedTag

      return { ...state, photosByPath, tagDescriptions, tagGroupAssignments, selectedTag }
    }
    case 'TAG_DELETED': {
      const photosByPath = new Map(state.photosByPath)
      for (const photo of action.photos) {
        photosByPath.set(photo.filePath, photo)
      }

      const tagDescriptions = new Map(state.tagDescriptions)
      tagDescriptions.delete(action.tag)

      const tagGroupAssignments = new Map(state.tagGroupAssignments)
      tagGroupAssignments.delete(action.tag)

      const selectedTag = state.selectedTag === action.tag ? null : state.selectedTag

      return { ...state, photosByPath, tagDescriptions, tagGroupAssignments, selectedTag }
    }
    case 'TAG_GROUPS_DATA_LOADED':
      return {
        ...state,
        tagGroups: action.groups,
        tagGroupAssignments: new Map(Object.entries(action.assignments))
      }
    case 'TAG_GROUP_CREATED':
      return { ...state, tagGroups: [...state.tagGroups, action.group] }
    case 'TAG_GROUP_RENAMED':
      return {
        ...state,
        tagGroups: state.tagGroups.map((group) =>
          group.id === action.id ? { ...group, name: action.name } : group
        )
      }
    case 'TAG_GROUP_MATCH_PATTERN_UPDATED':
      return {
        ...state,
        tagGroups: state.tagGroups.map((group) =>
          group.id === action.id ? { ...group, matchPattern: action.matchPattern } : group
        )
      }
    case 'TAG_GROUP_DELETED': {
      const tagGroups = state.tagGroups.filter((group) => group.id !== action.id)
      const tagGroupAssignments = new Map(
        Array.from(state.tagGroupAssignments).filter(([, groupId]) => groupId !== action.id)
      )
      return { ...state, tagGroups, tagGroupAssignments }
    }
    case 'TAG_GROUP_ASSIGNMENT_CHANGED': {
      const tagGroupAssignments = new Map(state.tagGroupAssignments)
      if (action.groupId === null) {
        tagGroupAssignments.delete(action.tag)
      } else {
        tagGroupAssignments.set(action.tag, action.groupId)
      }
      return { ...state, tagGroupAssignments }
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
    // Singleton tab — reactivates the existing one instead of opening a
    // second "Duplicates" tab if it's already open.
    case 'OPEN_DUPLICATES_TAB': {
      const openTabs = state.openTabs.includes('duplicates')
        ? state.openTabs
        : [...state.openTabs, 'duplicates']
      return { ...state, openTabs, activeTab: 'duplicates' }
    }
    case 'CLOSE_ALL_TABS':
      return { ...state, openTabs: [], compareTabs: new Map(), activeTab: 'gallery' }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab }
    // Repoints a renamed photo's tab (and active-tab pointer) at its new
    // path, instead of letting PHOTO_REMOVED prune it as if deleted.
    case 'RENAME_PHOTO_TAB': {
      // Also repoints an active search result set: this is dispatched on every
      // photo rename (before PHOTO_REMOVED/PHOTO_UPSERTED) and is the only
      // place that sees both paths, so a renamed photo stays in the results
      // instead of silently vanishing from them.
      const searchResults =
        state.searchResults && state.searchResults.paths.has(action.oldPath)
          ? {
              ...state.searchResults,
              paths: new Set(
                Array.from(state.searchResults.paths, (path) =>
                  path === action.oldPath ? action.newPath : path
                )
              )
            }
          : state.searchResults
      if (!state.openTabs.includes(action.oldPath)) {
        return searchResults === state.searchResults ? state : { ...state, searchResults }
      }
      // newPath may already be open elsewhere (e.g. arrow-key navigation
      // landing on it) — drop that occurrence instead of duplicating the tab.
      const openTabs = state.openTabs
        .filter((path) => path === action.oldPath || path !== action.newPath)
        .map((path) => (path === action.oldPath ? action.newPath : path))
      const activeTab = state.activeTab === action.oldPath ? action.newPath : state.activeTab
      return { ...state, openTabs, activeTab, searchResults }
    }
    case 'REORDER_PHOTO_TABS':
      return { ...state, openTabs: action.openTabs }
    default:
      return state
  }
}
