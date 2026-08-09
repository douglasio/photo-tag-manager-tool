import Database from 'better-sqlite3'
import { app } from 'electron'
import { copyFile, rm } from 'fs/promises'
import { join } from 'path'

import { closeDb, getDb, getDbPath } from '@main/db/database'

import { disposeDuplicateClusterWorker } from './duplicatePhotoService'
import { disposeTagSuggestionWorker } from './tagSuggestionService'
import { disposeThrowbackSimilarityWorker } from './throwbackService'
import { deleteAllThumbnails } from './thumbnailService'
import { unwatchAllFolders } from './watchManager'

// A raw copy of the live SQLite file — captures photos, tags, tag groups,
// settings, and embeddings perfectly with no custom serialization. Safe to
// run against the live connection regardless of WAL state (better-sqlite3's
// backup() performs an online hot backup, not a plain file copy).
export async function exportDatabase(destinationPath: string): Promise<void> {
  await getDb().backup(destinationPath)
}

// Opens the picked file as a throwaway read-only connection just to confirm
// it's actually a Tag Me database before letting importDatabase replace the
// live one with it — anything that fails to open, or opens but lacks the
// `photos` table, is rejected rather than silently wiping the real library.
export function validateDatabaseFile(filePath: string): boolean {
  let candidate: Database.Database | null = null
  try {
    candidate = new Database(filePath, { readonly: true, fileMustExist: true })
    const row = candidate
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'photos'")
      .get()
    return row !== undefined
  } catch {
    return false
  } finally {
    candidate?.close()
  }
}

// Shared by importDatabase/clearLibrary — both mutate the live DB file out
// from under the running app, so both stop everything that might touch it
// (watchers, AI workers) and close the connection before doing so.
async function shutDownForDataChange(): Promise<void> {
  await unwatchAllFolders()
  await Promise.all([
    disposeTagSuggestionWorker(),
    disposeDuplicateClusterWorker(),
    disposeThrowbackSimilarityWorker()
  ])
  closeDb()
}

// app.relaunch() spawns the new process immediately — it doesn't wait for
// this one to actually exit, so the new process's requestSingleInstanceLock()
// can race this process's (delayed until real OS exit) lock release and
// lose, silently skipping window/handler setup entirely. Releasing the lock
// explicitly first closes that race.
function relaunch(): void {
  app.releaseSingleInstanceLock()
  app.relaunch()
  app.exit(0)
}

// Restores from a backup by fully replacing the live library — not a merge.
// Ends the process; the relaunched app's normal startup (getDb()'s own
// migrations, main/index.ts watching every folder in the imported settings)
// picks up the swapped-in file with no extra wiring needed.
export async function importDatabase(sourcePath: string): Promise<void> {
  await shutDownForDataChange()

  const dbPath = getDbPath()
  await copyFile(sourcePath, dbPath)
  await Promise.all([rm(`${dbPath}-wal`, { force: true }), rm(`${dbPath}-shm`, { force: true })])

  relaunch()
}

// Full factory reset: wipes the database, every cached thumbnail, and the
// downloaded AI model weights (re-enabling AI afterward simply re-downloads
// them) — then relaunches into a completely fresh app.
export async function clearLibrary(): Promise<void> {
  await shutDownForDataChange()

  const dbPath = getDbPath()
  await Promise.all([
    rm(dbPath, { force: true }),
    rm(`${dbPath}-wal`, { force: true }),
    rm(`${dbPath}-shm`, { force: true }),
    deleteAllThumbnails(),
    rm(join(app.getPath('userData'), 'ai-models'), { recursive: true, force: true })
  ])

  relaunch()
}
