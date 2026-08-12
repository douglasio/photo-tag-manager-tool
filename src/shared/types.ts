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
