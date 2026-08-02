import { stat } from 'fs/promises'

import { findByPath, updateThumbnail, upsertPhoto } from '@main/db/photoRepository'
import type { PhotoRecord } from '@shared/types'

import { readPhotoRecord } from './metadataService'
import { generateThumbnail, thumbnailKeyFor } from './thumbnailService'

export async function ingestFile(
  filePath: string,
  thumbnailLimit: <T>(fn: () => Promise<T>) => Promise<T>,
  options?: {
    // Metadata-only writes (tags/comment/date-taken) bump mtime without
    // touching pixels — set this to skip the pointless thumbnail regen. Omit for rotate.
    pixelsUnchanged?: boolean
  }
): Promise<{ photo: PhotoRecord; fromCache: boolean }> {
  const fileStat = await stat(filePath)
  const cached = findByPath(filePath)

  let photo: PhotoRecord
  let fromCache = false

  if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.sizeBytes === fileStat.size) {
    photo = { ...cached.record, fromCache: true }
    fromCache = true
  } else {
    photo = await readPhotoRecord(filePath)
    if (options?.pixelsUnchanged && cached) {
      photo = {
        ...photo,
        thumbnailKey: cached.record.thumbnailKey,
        thumbnailStatus: cached.record.thumbnailStatus
      }
    }
    upsertPhoto(photo, fileStat.mtimeMs, fileStat.size)
    // upsertPhoto never touches the viewCount column (a rescan must not
    // reset it) — reflect its true, preserved DB value here too, rather
    // than the fresh-read placeholder of 0.
    photo = { ...photo, viewCount: cached?.record.viewCount ?? 0 }
  }

  if (photo.thumbnailStatus !== 'ready') {
    const key = thumbnailKeyFor(filePath, fileStat.mtimeMs, fileStat.size)
    await thumbnailLimit(async () => {
      try {
        await generateThumbnail(filePath, key)
        updateThumbnail(filePath, key, 'ready')
        photo = { ...photo, thumbnailStatus: 'ready', thumbnailKey: key }
      } catch {
        updateThumbnail(filePath, key, 'error')
        photo = { ...photo, thumbnailStatus: 'error', thumbnailKey: null }
      }
    })
  }

  return { photo, fromCache }
}
