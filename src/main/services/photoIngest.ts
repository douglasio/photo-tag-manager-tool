import type { Stats } from 'fs'
import { stat } from 'fs/promises'

import { findByPath, updateThumbnail, upsertPhoto } from '@main/db/photoRepository'
import type { PhotoRecord } from '@shared/types'

import { readPhotoRecord } from './metadataService'
import { generateThumbnail, thumbnailKeyFor } from './thumbnailService'

export interface IngestMetadataResult {
  photo: PhotoRecord
  fromCache: boolean
  fileStat: Stats
}

type CacheEntry = { record: PhotoRecord; mtimeMs: number; sizeBytes: number }

// Splits out metadata ingestion so a bulk scan can run this under its own concurrency limit
export async function ingestMetadata(
  filePath: string,
  options?: {
    // Metadata-only writes (tags/comment/date-taken) bump mtime without touching pixels
    pixelsUnchanged?: boolean
    // A bulk scan prefetches every root's cache rows in a few LIKE queries
    // up front (findManyByPathPrefix) instead of one findByPath call per
    // file — pass the looked-up entry (or null if none) to skip the
    // per-file lookup here. Omitted entirely (not just undefined) means
    // "look it up yourself," which every single-file caller relies on.
    prefetched?: CacheEntry | null
    // A bulk scan also defers the actual write, collecting entries to flush
    // via upsertPhotosBatch instead of one autocommit write per file. When
    // omitted, this writes immediately via upsertPhoto, same as before.
    deferredWrite?: (entry: CacheEntry) => void
  }
): Promise<IngestMetadataResult> {
  const fileStat = await stat(filePath)
  const usePrefetched = options !== undefined && 'prefetched' in options
  const cached = usePrefetched ? (options.prefetched ?? null) : findByPath(filePath)

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
    const entry: CacheEntry = { record: photo, mtimeMs: fileStat.mtimeMs, sizeBytes: fileStat.size }
    if (options?.deferredWrite) {
      options.deferredWrite(entry)
    } else {
      upsertPhoto(photo, fileStat.mtimeMs, fileStat.size)
    }
    // Reflect true DB values here instead of readPhotoRecord's placeholders
    photo = {
      ...photo,
      viewCount: cached?.record.viewCount ?? 0,
      firstSeenAt: cached?.record.firstSeenAt ?? Date.now()
    }
  }

  return { photo, fromCache, fileStat }
}

// A generation failure is recorded as a normal 'error' status rather than rejecting, so callers can fire-and-collect these freely
export async function ingestThumbnail(
  filePath: string,
  photo: PhotoRecord,
  fileStat: Pick<Stats, 'mtimeMs' | 'size'>
): Promise<PhotoRecord> {
  const key = thumbnailKeyFor(filePath, fileStat.mtimeMs, fileStat.size)
  try {
    await generateThumbnail(filePath, key)
    updateThumbnail(filePath, key, 'ready')
    return { ...photo, thumbnailStatus: 'ready', thumbnailKey: key }
  } catch {
    updateThumbnail(filePath, key, 'error')
    return { ...photo, thumbnailStatus: 'error', thumbnailKey: null }
  }
}

export async function ingestFile(
  filePath: string,
  thumbnailLimit: <T>(fn: () => Promise<T>) => Promise<T>,
  options?: {
    pixelsUnchanged?: boolean
  }
): Promise<{ photo: PhotoRecord; fromCache: boolean }> {
  const { photo: metaPhoto, fromCache, fileStat } = await ingestMetadata(filePath, options)
  let photo = metaPhoto

  if (photo.thumbnailStatus !== 'ready') {
    photo = await thumbnailLimit(() => ingestThumbnail(filePath, photo, fileStat))
  }

  return { photo, fromCache }
}
