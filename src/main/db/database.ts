import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'photag.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      path TEXT PRIMARY KEY,
      fileName TEXT NOT NULL,
      mtimeMs REAL NOT NULL,
      sizeBytes INTEGER NOT NULL,
      tags TEXT NOT NULL,
      dateTaken TEXT,
      cameraMake TEXT,
      cameraModel TEXT,
      widthPx INTEGER,
      heightPx INTEGER,
      format TEXT NOT NULL,
      thumbnailKey TEXT,
      thumbnailStatus TEXT NOT NULL DEFAULT 'pending',
      lastScannedAt INTEGER NOT NULL
    )
  `)

  return db
}
