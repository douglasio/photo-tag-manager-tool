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
  totalScanned: number
  cacheHits: number
  errors: { filePath: string; message: string }[]
  // Every folder under the scanned root, including empty ones — separate
  // from photo-derived folder structure, which never includes folders with
  // no photos in them.
  allFolders: string[]
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
