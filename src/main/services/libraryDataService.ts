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

// A raw copy of the live SQLite file
export async function exportDatabase(destinationPath: string): Promise<void> {
  await getDb().backup(destinationPath)
}

// Opens the picked file as a throwaway read-only connection just to confirm
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

// Shared by importDatabase/clearLibrary — stops everything before mutating db
async function shutDownForDataChange(): Promise<void> {
  await unwatchAllFolders()
  await Promise.all([
    disposeTagSuggestionWorker(),
    disposeDuplicateClusterWorker(),
    disposeThrowbackSimilarityWorker()
  ])
  closeDb()
}

// app.relaunch() spawns the new process immediately
function relaunch(): void {
  app.releaseSingleInstanceLock()
  app.relaunch()
  app.exit(0)
}

// Restores from a backup by fully replacing the live library
export async function importDatabase(sourcePath: string): Promise<void> {
  await shutDownForDataChange()

  const dbPath = getDbPath()
  await copyFile(sourcePath, dbPath)
  await Promise.all([rm(`${dbPath}-wal`, { force: true }), rm(`${dbPath}-shm`, { force: true })])

  relaunch()
}

// Full factory reset: wipes the database
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
