import { stat } from 'fs/promises'

import { findByPath, updateThumbnail, upsertPhoto } from '@main/db/photoRepository'
import type { PhotoRecord } from '@shared/types'

import { readPhotoRecord } from './metadataService'
import { generateThumbnail, thumbnailKeyFor } from './thumbnailService'

export async function ingestFile(
  filePath: string,
  thumbnailLimit: <T>(fn: () => Promise<T>) => Promise<T>
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
    upsertPhoto(photo, fileStat.mtimeMs, fileStat.size)
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
