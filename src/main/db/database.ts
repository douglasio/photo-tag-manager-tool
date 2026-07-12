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

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // App-local tag metadata (description, etc). Deliberately never written back to
  // the photo files themselves — it's a local annotation layer on top of the tags
  // that live in EXIF/IPTC.
  db.exec(`
    CREATE TABLE IF NOT EXISTS tag_metadata (
      tag TEXT PRIMARY KEY,
      description TEXT
    )
  `)

  const photoColumns = db.prepare('PRAGMA table_info(photos)').all() as { name: string }[]
  if (!photoColumns.some((column) => column.name === 'comment')) {
    db.exec('ALTER TABLE photos ADD COLUMN comment TEXT')
  }

  return db
}
