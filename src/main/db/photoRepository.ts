import { getDb } from './database'
import type { PhotoRecord } from '../../shared/types'

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
}

function rowToPhotoRecord(row: PhotoRow): PhotoRecord {
  return {
    id: row.path,
    filePath: row.path,
    fileName: row.fileName,
    tags: JSON.parse(row.tags),
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
    fromCache: false
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
        widthPx, heightPx, format, comment, thumbnailKey, thumbnailStatus, lastScannedAt
      ) VALUES (
        @path, @fileName, @mtimeMs, @sizeBytes, @tags, @dateTaken, @cameraMake, @cameraModel,
        @widthPx, @heightPx, @format, @comment, @thumbnailKey, @thumbnailStatus, @lastScannedAt
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
      tags: JSON.stringify(record.tags),
      dateTaken: record.metadata.dateTaken,
      cameraMake: record.metadata.cameraMake,
      cameraModel: record.metadata.cameraModel,
      widthPx: record.metadata.widthPx,
      heightPx: record.metadata.heightPx,
      format: record.metadata.format,
      comment: record.metadata.comment,
      thumbnailKey: record.thumbnailKey,
      thumbnailStatus: record.thumbnailStatus,
      lastScannedAt: Date.now()
    })
}

export function updateThumbnail(
  filePath: string,
  thumbnailKey: string,
  status: 'ready' | 'error'
): void {
  getDb()
    .prepare('UPDATE photos SET thumbnailKey = ?, thumbnailStatus = ? WHERE path = ?')
    .run(thumbnailKey, status, filePath)
}

/** Deletes a single photo row (used by the folder watcher on file removal). Returns its thumbnailKey, if any, so the caller can clean up the thumbnail file. */
export function removePhoto(filePath: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT thumbnailKey FROM photos WHERE path = ?').get(filePath) as
    { thumbnailKey: string | null } | undefined
  if (!row) return null

  db.prepare('DELETE FROM photos WHERE path = ?').run(filePath)
  return row.thumbnailKey
}

/** Moves a photo's cached row to a new path/fileName in place, preserving its
 * thumbnail, metadata, and tags — used for renames, where the file's content
 * (and therefore mtime/size/thumbnail) doesn't actually change. */
export function renamePhotoPath(oldPath: string, newPath: string, fileName: string): void {
  getDb()
    .prepare('UPDATE photos SET path = @newPath, fileName = @fileName WHERE path = @oldPath')
    .run({ oldPath, newPath, fileName })
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

  return stale.map((row) => row.thumbnailKey).filter((key): key is string => Boolean(key))
}
