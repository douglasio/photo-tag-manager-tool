export type SupportedFormat = 'JPEG' | 'PNG' | 'TIFF'

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
  rootPath: string
  totalScanned: number
  cacheHits: number
  errors: { filePath: string; message: string }[]
  // Every folder under the scanned root, including empty ones — separate
  // from photo-derived folder structure, which never includes folders with
  // no photos in them.
  allFolders: string[]
  // The complete, authoritative set of files that exist under rootPath as of
  // this scan (post exclude-pattern filtering) — lets the renderer prune
  // anything it previously knew about that's no longer present (deleted, or
  // newly excluded). Null when the scan aborted before enumerating anything
  // (root became inaccessible, or the scan was cancelled), so the renderer
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
  sortBy: 'name' | 'dateTaken'
  sortOrder: 'asc' | 'desc'
}

export interface MoveProgressEvent {
  completed: number
  total: number
}
