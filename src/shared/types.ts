export type SupportedFormat = 'JPEG' | 'PNG' | 'TIFF'

export interface PhotoMetadata {
  dateTaken: string | null
  cameraMake: string | null
  cameraModel: string | null
  widthPx: number | null
  heightPx: number | null
  fileSizeBytes: number
  format: SupportedFormat
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
}
