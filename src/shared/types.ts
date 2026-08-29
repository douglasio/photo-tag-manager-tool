import type { ReactElement } from 'react'

export type DefaultView = 'dashboard' | 'gallery'

export type GalleryViewMode = 'grid' | 'list'

export type SupportedFormat = 'JPEG' | 'PNG' | 'TIFF'

// Lossless EXIF-orientation-flip rotation — only meaningful for formats
// whose Orientation tag viewers actually respect (JPEG/TIFF; PNG's EXIF
// support is too inconsistent across viewers to rely on).
export type RotateDirection = 'left' | 'right'
export const ROTATABLE_FORMATS: SupportedFormat[] = ['JPEG', 'TIFF']

export interface PhotoMetadata {
  dateTaken: string | null
  cameraMake: string | null
  cameraModel: string | null
  widthPx: number | null
  heightPx: number | null
  fileSizeBytes: number
  format: SupportedFormat
  comment: string | null
}

export type ThumbnailStatus = 'pending' | 'ready' | 'error'

export interface PhotoRecord {
  id: string
  filePath: string
  fileName: string
  tags: string[]
  metadata: PhotoMetadata
  thumbnailStatus: ThumbnailStatus
  thumbnailKey: string | null
  scanError: string | null
  fromCache: boolean
  // App-local view count — how many times this photo has been opened in a
  // tab or previewed with the gallery's hover/spacebar preview. Lives only
  // in the local DB, never written back to the file (same reasoning as
  // thumbnailKey/thumbnailStatus above).
  viewCount: number
  // Epoch ms this photo first entered the library — set once and never
  // updated by a rescan (unlike lastScannedAt, which isn't otherwise
  // exposed to the renderer). Optional so the many existing test fixtures
  // that build a PhotoRecord by hand don't all need updating; genuine
  // records from the DB always have it.
  firstSeenAt?: number
  // The file's filesystem last-modified time (epoch ms) — used by the
  // Duplicates view's "date modified" column. Optional for the same reason
  // as firstSeenAt above.
  mtimeMs?: number
}

export interface ScanStartResult {
  scanId: string
}

export interface ScanProgressEvent {
  scanId: string
  filesFound: number
}

export interface MetadataBatchEvent {
  scanId: string
  photos: PhotoRecord[]
}

export interface ScanCompleteEvent {
  scanId: string
  // Every watched folder this scan covered — a single-folder scan (e.g.
  // adding one new folder) sends a one-element array, same shape as a
  // combined startup/rescan-all sweep across every watched folder.
  rootPaths: string[]
  totalScanned: number
  cacheHits: number
  errors: { filePath: string; message: string }[]
  // Every folder under the scanned roots, including empty ones — separate
  // from photo-derived folder structure, which never includes folders with
  // no photos in them.
  allFolders: string[]
  // The complete, authoritative set of files that exist under rootPaths as of
  // this scan (post exclude-pattern filtering) — lets the renderer prune
  // anything it previously knew about that's no longer present (deleted, or
  // newly excluded). Null when the scan aborted before enumerating anything
  // (a root became inaccessible, or the scan was cancelled), so the renderer
  // knows not to prune from incomplete data.
  filePaths: string[] | null
}

export interface WatchPhotoUpsertedEvent {
  photo: PhotoRecord
  changeType: 'add' | 'change'
}

export interface WatchPhotoRemovedEvent {
  filePath: string
}

export interface WatchFolderAddedEvent {
  folderPath: string
}

export interface WatchFolderRemovedEvent {
  folderPath: string
}

export interface GallerySort {
  sortBy: 'name' | 'dateTaken' | 'viewCount' | 'random'
  sortOrder: 'asc' | 'desc'
}

// Every field PhotoLibraryContext's startup effect needs from the settings
// table, batched into one IPC round-trip instead of ~20 separate ones.
export interface AppSettings {
  gallerySort: GallerySort | null
  defaultView: DefaultView
  showEmptyFolders: boolean
  tagsPanelGridView: boolean
  peoplePanelGridView: boolean
  galleryViewMode: GalleryViewMode
  aiTagSuggestionsEnabled: boolean
  faceDetectionEnabled: boolean
  detailsPanelCollapsed: boolean
  galleryAnimationsEnabled: boolean
  showFilenames: boolean
  showViewCounts: boolean
  magazineTitle: string
  newspaperTitle: string
  dvdStudioName: string
  artGalleryName: string
  navbarSplitSizes: number[] | null
  navbarWidth: number | null
  galleryCellWidth: number | null
  navbarCollapsedPanels: Record<string, boolean>
  excludePatterns: string[]
  excludedFolders: string[]
}

export interface SearchHit {
  filePath: string
  fileName: string
  /** Relevance score — searchRepository's weighted heuristic, or cosine
   * similarity for semantic hits. Not comparable across the two sources. */
  score: number
  thumbnailKey: string | null
}

export interface SearchResult {
  /** Top-ranked hits, capped by the request's limit. */
  hits: SearchHit[]
  /** Every match, regardless of limit — drives the "show all N" affordance. */
  total: number
  /** Every matching path in rank order, for filtering the gallery grid. */
  paths: string[]
}

export interface SemanticSearchResult {
  /** CLIP-similarity-ranked hits, already thresholded and capped. */
  hits: SearchHit[]
  /** Photos with a cached embedding to search against. */
  indexedCount: number
  /** Photos that could have one (AI scan has processed them) — the gap
   * between this and indexedCount is photos the AI scan hasn't reached yet. */
  totalReadyCount: number
}

// The main window's persisted geometry. Deliberately absent from AppSettings
// above — the renderer never reads or writes it; the main process restores it
// before the window exists and saves it as the user drags/resizes.
export interface WindowState {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

export interface MoveProgressEvent {
  completed: number
  total: number
}

export interface TagGroup {
  id: string
  name: string
  position: number
  // Case-insensitive substring a tag must contain to be auto-added to this
  // group; null means no rule.
  matchPattern: string | null
}

export interface Widget {
  id: string
  title: string
  description?: string
  component: ReactElement
  // How many of the dashboard grid's columns this widget's cell should span.
  // Omitted (or 1) is the default single-column width.
  colSpan?: number
}

export interface TagSuggestion {
  tag: string
  score: number
}

export interface DuplicateGroup {
  filePaths: string[]
  // Average pairwise cosine similarity across the group's members.
  similarity: number
}

export interface SimilarPhoto {
  filePath: string
  score: number
}

// One year's representative photo — used by the Throwback widget for both
// its real cross-year similarity result and its random "preview" mode
// (same shape, different selection method).
export interface ThrowbackEntry {
  year: number
  filePath: string
}

export interface ThrowbackYearSample {
  year: number
  filePaths: string[]
}

// Spans the whole "enable AI features" flow: model download, then warming
// the shared embedding cache, then clustering duplicates. 'clustering's
// done/total are a normalized 0-100 percentage, never the raw n*(n-1)/2
// pair count — that number is huge even for modest libraries and reads as
// alarming/broken if shown directly.
export type AiScanPhase = 'downloading' | 'embedding' | 'clustering'

export interface AiScanProgress {
  phase: AiScanPhase
  done: number
  total: number
}

export interface AiScanResult {
  duplicateGroups: DuplicateGroup[]
  photosScanned: number
  canceled: boolean
}

// The background embedding indexer's status — unlike AiScanProgress this is
// single-phase (just embedding) and ambient rather than tied to one
// user-triggered request, so it has no 'downloading'/'clustering' phase.
export interface EmbeddingIndexProgress {
  done: number
  total: number
}

// Normalized 0..1 against the photo's own dimensions, not raw pixels — keeps
// this independent of which resolution the box was detected against.
export interface FaceBox {
  x: number
  y: number
  w: number
  h: number
}

export interface FaceRecord {
  id: string
  photoPath: string
  box: FaceBox
  personId: string | null
  // True once this face's person assignment was set by an explicit user
  // action (assign/merge/split) rather than automatic clustering — mirrors
  // TagGroup's matchPattern-vs-manual distinction. A pinned face is never
  // reassigned by a future clustering pass.
  personIdPinned: boolean
}

export interface PersonRecord {
  id: string
  // Null until the user labels this person ("Unnamed person" in the UI).
  name: string | null
  coverFaceId: string | null
  // The cover face's own photo — resolved directly by getPeople() so the
  // People panel doesn't need a separate face-lookup round trip just to
  // render a representative thumbnail.
  coverPhotoPath: string | null
  // The cover face's own crop box within coverPhotoPath — lets the UI show a
  // face-zoomed crop (via FaceCropThumbnail) instead of the full photo.
  coverFaceBox: FaceBox | null
  faceCount: number
  // Same free-text pattern as tag_metadata.description.
  description: string | null
}

export type FaceScanPhase = 'detecting' | 'clustering'

export interface FaceScanProgress {
  phase: FaceScanPhase
  done: number
  total: number
}

export interface FaceScanResult {
  facesDetected: number
  peopleCount: number
  photosScanned: number
  canceled: boolean
}
