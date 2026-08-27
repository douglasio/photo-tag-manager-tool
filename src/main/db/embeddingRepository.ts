import type Database from 'better-sqlite3'

import { isUnderExcludedFolder } from '@shared/folderExclusion'

import { getDb } from './database'
import { getExcludedFolders } from './settingsRepository'

// getAllEmbeddings runs on every DetailPanel photo selection (via
// findSimilarPhotos) — re-reading and deserializing every embedding blob
// from SQLite per click doesn't scale past a few thousand photos, so the
// full row set is cached here. Any write invalidates it (the next read
// rebuilds), and keying by the Database instance makes a closeDb()/reopen
// (library import/clear) self-invalidating without any extra wiring.
let allRowsCache: {
  db: Database.Database
  rows: { filePath: string; embedding: Float32Array }[]
} | null = null

function invalidateAllRowsCache(): void {
  allRowsCache = null
}

export function getEmbedding(filePath: string): Float32Array | null {
  const row = getDb()
    .prepare('SELECT embedding FROM photo_embeddings WHERE path = ?')
    .get(filePath) as { embedding: Buffer } | undefined
  if (!row) return null
  return new Float32Array(
    row.embedding.buffer,
    row.embedding.byteOffset,
    row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
  )
}

export function setEmbedding(filePath: string, embedding: Float32Array): void {
  const buffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength)
  getDb()
    .prepare(
      `INSERT INTO photo_embeddings (path, embedding) VALUES (@path, @embedding)
       ON CONFLICT(path) DO UPDATE SET embedding = excluded.embedding`
    )
    .run({ path: filePath, embedding: buffer })
  invalidateAllRowsCache()
}

/** Every cached embedding outside an excluded folder — used for duplicate
 * detection and Time Warp, which both need to compare a photo against the
 * whole set rather than one tag's examples. The excluded-folder filter is
 * applied per call (settings can change at runtime); only the DB read +
 * blob deserialization is cached. */
export function getAllEmbeddings(): { filePath: string; embedding: Float32Array }[] {
  const db = getDb()
  if (!allRowsCache || allRowsCache.db !== db) {
    const rows = db.prepare('SELECT path, embedding FROM photo_embeddings').all() as {
      path: string
      embedding: Buffer
    }[]
    allRowsCache = {
      db,
      rows: rows.map((row) => ({
        filePath: row.path,
        embedding: new Float32Array(
          row.embedding.buffer,
          row.embedding.byteOffset,
          row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
        )
      }))
    }
  }
  const excludedFolders = getExcludedFolders()
  if (excludedFolders.length === 0) return allRowsCache.rows
  return allRowsCache.rows.filter((row) => !isUnderExcludedFolder(row.filePath, excludedFolders))
}

export function deleteEmbedding(filePath: string): void {
  getDb().prepare('DELETE FROM photo_embeddings WHERE path = ?').run(filePath)
  invalidateAllRowsCache()
}

export function renameEmbedding(oldPath: string, newPath: string): void {
  getDb()
    .prepare('UPDATE photo_embeddings SET path = @newPath WHERE path = @oldPath')
    .run({ oldPath, newPath })
  invalidateAllRowsCache()
}
