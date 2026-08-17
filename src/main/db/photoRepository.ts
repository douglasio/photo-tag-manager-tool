import { isUnderExcludedFolder } from '@shared/folderExclusion'
import type { PhotoRecord } from '@shared/types'

import { getDb } from './database'
import { deleteEmbedding, renameEmbedding } from './embeddingRepository'
import { deleteFacesForPhoto, renameFacesForPhoto } from './faceRepository'
import { getExcludedFolders } from './settingsRepository'
import { reconcileTagGroups } from './tagMetadataRepository'

interface PhotoRow {
  path: string
  fileName: string
  mtimeMs: number
  sizeBytes: number
  tags: string
  dateTaken: string | null
  cameraMake: string | null
  cameraModel: string | null
  widthPx: number | null
  heightPx: number | null
  format: string
  comment: string | null
  thumbnailKey: string | null
  thumbnailStatus: string
  viewCount: number
  firstSeenAt: number | null
}

// Coerces every element to a string — a row written before metadataService's
// own toArray() started doing this can still have a non-string tag (e.g. a
// number from a purely-numeric EXIF keyword) sitting in the DB, which
// crashes TagsInput's rendering downstream if passed through as-is.
function parsePhotoTags(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed.map((tag) => String(tag)) : []
}

function rowToPhotoRecord(row: PhotoRow): PhotoRecord {
  return {
    id: row.path,
    filePath: row.path,
    fileName: row.fileName,
    tags: parsePhotoTags(row.tags),
    metadata: {
      dateTaken: row.dateTaken,
      cameraMake: row.cameraMake,
      cameraModel: row.cameraModel,
      widthPx: row.widthPx,
      heightPx: row.heightPx,
      fileSizeBytes: row.sizeBytes,
      format: row.format as PhotoRecord['metadata']['format'],
      comment: row.comment
    },
    thumbnailStatus: row.thumbnailStatus as PhotoRecord['thumbnailStatus'],
    thumbnailKey: row.thumbnailKey,
    scanError: null,
    // Callers that actually hit the cache (see scanHandlers.ts's processFile)
    // override this to true; a DB row read on its own isn't "from cache."
    fromCache: false,
    viewCount: row.viewCount,
    firstSeenAt: row.firstSeenAt ?? undefined,
    mtimeMs: row.mtimeMs
  }
}

export function findByPath(
  filePath: string
): { record: PhotoRecord; mtimeMs: number; sizeBytes: number } | null {
  const row = getDb().prepare('SELECT * FROM photos WHERE path = ?').get(filePath) as
    PhotoRow | undefined
  if (!row) return null
  return { record: rowToPhotoRecord(row), mtimeMs: row.mtimeMs, sizeBytes: row.sizeBytes }
}

export function upsertPhoto(record: PhotoRecord, mtimeMs: number, sizeBytes: number): void {
  getDb()
    .prepare(
      `INSERT INTO photos (
        path, fileName, mtimeMs, sizeBytes, tags, dateTaken, cameraMake, cameraModel,
        widthPx, heightPx, format, comment, thumbnailKey, thumbnailStatus, lastScannedAt, firstSeenAt
      ) VALUES (
        @path, @fileName, @mtimeMs, @sizeBytes, @tags, @dateTaken, @cameraMake, @cameraModel,
        @widthPx, @heightPx, @format, @comment, @thumbnailKey, @thumbnailStatus, @lastScannedAt, @firstSeenAt
      )
      ON CONFLICT(path) DO UPDATE SET
        fileName = excluded.fileName,
        mtimeMs = excluded.mtimeMs,
        sizeBytes = excluded.sizeBytes,
        tags = excluded.tags,
        dateTaken = excluded.dateTaken,
        cameraMake = excluded.cameraMake,
        cameraModel = excluded.cameraModel,
        widthPx = excluded.widthPx,
        heightPx = excluded.heightPx,
        format = excluded.format,
        comment = excluded.comment,
        thumbnailKey = excluded.thumbnailKey,
        thumbnailStatus = excluded.thumbnailStatus,
        lastScannedAt = excluded.lastScannedAt`
    )
    .run({
      path: record.filePath,
      fileName: record.fileName,
      mtimeMs,
      sizeBytes,
      // Coerced defensively (not just trusted as already string[]) — this is
      // the one place anything ever writes to photos.tags, so guaranteeing
      // the invariant here closes off every downstream read path at once.
      tags: JSON.stringify(record.tags.map(String)),
      dateTaken: record.metadata.dateTaken,
      cameraMake: record.metadata.cameraMake,
      cameraModel: record.metadata.cameraModel,
      widthPx: record.metadata.widthPx,
      heightPx: record.metadata.heightPx,
      format: record.metadata.format,
      comment: record.metadata.comment,
      thumbnailKey: record.thumbnailKey,
      thumbnailStatus: record.thumbnailStatus,
      lastScannedAt: Date.now(),
      // Only takes effect on a true INSERT — absent from ON CONFLICT SET above.
      firstSeenAt: Date.now()
    })
}

/** Bumps a photo's view count by one. Deliberately not part of upsertPhoto's
 * column set — a rescan (which re-upserts every touched photo) must never
 * reset or overwrite this. */
export function incrementViewCount(filePath: string): void {
  getDb().prepare('UPDATE photos SET viewCount = viewCount + 1 WHERE path = ?').run(filePath)
}

/** Up to `limit` ready-thumbnail photos carrying `tag` — used to build a tag's
 * exemplar embedding set. `tags` is stored as a JSON array string, so this
 * pre-filters with a cheap substring search, then confirms with a real parse. */
export function findPhotoPathsWithTag(
  tag: string,
  limit: number
): { filePath: string; thumbnailKey: string }[] {
  const excludedFolders = getExcludedFolders()
  const matches: { filePath: string; thumbnailKey: string }[] = []
  const rows = getDb()
    .prepare(
      `SELECT path, tags, thumbnailKey FROM photos
       WHERE thumbnailStatus = 'ready' AND thumbnailKey IS NOT NULL AND instr(tags, ?) > 0`
    )
    .iterate(`"${tag}"`) as IterableIterator<{
    path: string
    tags: string
    thumbnailKey: string
  }>

  for (const row of rows) {
    if (matches.length >= limit) break
    if (isUnderExcludedFolder(row.path, excludedFolders)) continue
    try {
      if (parsePhotoTags(row.tags).includes(tag)) {
        matches.push({ filePath: row.path, thumbnailKey: row.thumbnailKey })
      }
    } catch {
      // Malformed tags JSON on this row — skip it.
    }
  }

  return matches
}

/** Every thumbnail-ready photo outside an excluded folder — used to build
 * the duplicate-detection embedding set. */
export function findAllReadyPhotos(): { filePath: string; thumbnailKey: string }[] {
  const excludedFolders = getExcludedFolders()
  const rows = getDb()
    .prepare(
      `SELECT path, thumbnailKey FROM photos WHERE thumbnailStatus = 'ready' AND thumbnailKey IS NOT NULL`
    )
    .all() as { path: string; thumbnailKey: string }[]
  return rows
    .filter((row) => !isUnderExcludedFolder(row.path, excludedFolders))
    .map((row) => ({ filePath: row.path, thumbnailKey: row.thumbnailKey }))
}

/** Every thumbnail-ready photo with a known dateTaken, outside an excluded
 * folder — used to group photos by year for the Throwback widget. */
export function findAllReadyPhotosWithDate(): {
  filePath: string
  thumbnailKey: string
  dateTaken: string
}[] {
  const excludedFolders = getExcludedFolders()
  const rows = getDb()
    .prepare(
      `SELECT path, thumbnailKey, dateTaken FROM photos
       WHERE thumbnailStatus = 'ready' AND thumbnailKey IS NOT NULL AND dateTaken IS NOT NULL`
    )
    .all() as { path: string; thumbnailKey: string; dateTaken: string }[]
  return rows
    .filter((row) => !isUnderExcludedFolder(row.path, excludedFolders))
    .map((row) => ({
      filePath: row.path,
      thumbnailKey: row.thumbnailKey,
      dateTaken: row.dateTaken
    }))
}

/** Reverse lookup for the thumbnail protocol handler's regenerate-on-miss
 * fallback — the request only carries the thumbnailKey, not the photo's
 * actual filePath. */
export function findByThumbnailKey(thumbnailKey: string): { filePath: string } | null {
  const row = getDb()
    .prepare('SELECT path FROM photos WHERE thumbnailKey = ?')
    .get(thumbnailKey) as { path: string } | undefined
  return row ? { filePath: row.path } : null
}

// A regenerated thumbnail (e.g. after rotate) means the pixels underneath
// any cached embedding changed too, so that embedding is stale — deleting it
// here lets it recompute lazily next time something needs it.
export function updateThumbnail(
  filePath: string,
  thumbnailKey: string,
  status: 'ready' | 'error'
): void {
  getDb()
    .prepare('UPDATE photos SET thumbnailKey = ?, thumbnailStatus = ? WHERE path = ?')
    .run(thumbnailKey, status, filePath)
  deleteEmbedding(filePath)
}

/** Deletes a single photo row (used by the folder watcher on file removal). Returns its thumbnailKey, if any, so the caller can clean up the thumbnail file. */
export function removePhoto(filePath: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT thumbnailKey FROM photos WHERE path = ?').get(filePath) as
    { thumbnailKey: string | null } | undefined
  if (!row) return null

  db.prepare('DELETE FROM photos WHERE path = ?').run(filePath)
  reconcileTagGroups()
  deleteEmbedding(filePath)
  deleteFacesForPhoto(filePath)
  return row.thumbnailKey
}

/** Moves a photo's cached row to a new path/fileName in place, preserving its
 * thumbnail, metadata, and tags — used for renames, where the file's content
 * (and therefore mtime/size/thumbnail) doesn't actually change. */
export function renamePhotoPath(oldPath: string, newPath: string, fileName: string): void {
  getDb()
    .prepare('UPDATE photos SET path = @newPath, fileName = @fileName WHERE path = @oldPath')
    .run({ oldPath, newPath, fileName })
  renameEmbedding(oldPath, newPath)
  renameFacesForPhoto(oldPath, newPath)
}

function isPathUnderFolder(path: string, folder: string): boolean {
  if (!path.startsWith(folder)) return false
  const nextChar = path[folder.length]
  return nextChar === '/' || nextChar === '\\'
}

/** Bulk-rewrites the path prefix of every photo row nested under (or equal
 * to) oldFolder — used for folder renames, where every nested photo's
 * content and fileName are untouched but the folder segment of its stored
 * path changes. Filters the broad `LIKE` match down to true descendants (not
 * just any path sharing the same string prefix, e.g. a sibling "FooBar" when
 * renaming "Foo") before writing anything. */
export function renamePhotoPathPrefix(oldFolder: string, newFolder: string): void {
  const db = getDb()
  const rows = db.prepare('SELECT path FROM photos WHERE path LIKE ?').all(`${oldFolder}%`) as {
    path: string
  }[]

  const affected = rows
    .filter((row) => row.path === oldFolder || isPathUnderFolder(row.path, oldFolder))
    .map((row) => ({ oldPath: row.path, newPath: newFolder + row.path.slice(oldFolder.length) }))

  if (affected.length === 0) return

  const update = db.prepare('UPDATE photos SET path = @newPath WHERE path = @oldPath')
  const updateMany = db.transaction((pairs: { oldPath: string; newPath: string }[]) => {
    for (const pair of pairs) update.run(pair)
  })
  updateMany(affected)
  for (const { oldPath, newPath } of affected) {
    renameEmbedding(oldPath, newPath)
    renameFacesForPhoto(oldPath, newPath)
  }
}

export function pruneMissing(rootPath: string, seenPaths: Set<string>): string[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT path, thumbnailKey FROM photos WHERE path LIKE ?')
    .all(`${rootPath}%`) as { path: string; thumbnailKey: string | null }[]

  const stale = rows.filter((row) => !seenPaths.has(row.path))
  if (stale.length === 0) return []

  const del = db.prepare('DELETE FROM photos WHERE path = ?')
  const deleteMany = db.transaction((paths: string[]) => {
    for (const p of paths) del.run(p)
  })
  deleteMany(stale.map((row) => row.path))
  reconcileTagGroups()
  for (const row of stale) {
    deleteEmbedding(row.path)
    deleteFacesForPhoto(row.path)
  }

  return stale.map((row) => row.thumbnailKey).filter((key): key is string => Boolean(key))
}
