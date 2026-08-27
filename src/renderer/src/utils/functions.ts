import type { PhotoRecord } from '@shared/types'

export function isNullOrEmpty(value: unknown): boolean {
  return value == null || String(value).trim() === ''
}

// A photo whose thumbnail exists and can actually be rendered — the shared
// gate used by every widget/tile that shows a thumbnail image. The type
// guard lets callers use photo.thumbnailKey without a non-null assertion.
export function isPhotoDisplayable(
  photo: PhotoRecord
): photo is PhotoRecord & { thumbnailKey: string } {
  return photo.thumbnailStatus === 'ready' && photo.thumbnailKey != null
}
