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

  // App-local tag metadata (description, group membership, etc). Deliberately
  // never written back to the photo files themselves — it's a local annotation
  // layer on top of the tags that live in EXIF/IPTC.
  db.exec(`
    CREATE TABLE IF NOT EXISTS tag_metadata (
      tag TEXT PRIMARY KEY,
      description TEXT
    )
  `)

  // User-defined tag groups (see TagPanel's accordion view). A tag belongs to
  // at most one group, recorded as tag_metadata.group_id — groups themselves
  // are never deleted as a side effect of anything (e.g. going empty); only
  // an explicit user action removes one.
  db.exec(`
    CREATE TABLE IF NOT EXISTS tag_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL
    )
  `)

  // CLIP image embeddings, cached per photo once computed (see
  // tagExemplarService) — lets "photos visually similar to this tag's
  // existing examples" suggestions reuse work across requests.
  db.exec(`
    CREATE TABLE IF NOT EXISTS photo_embeddings (
      path TEXT PRIMARY KEY,
      embedding BLOB NOT NULL
    )
  `)

  const photoColumns = db.prepare('PRAGMA table_info(photos)').all() as { name: string }[]
  if (!photoColumns.some((column) => column.name === 'comment')) {
    db.exec('ALTER TABLE photos ADD COLUMN comment TEXT')
  }
  if (!photoColumns.some((column) => column.name === 'viewCount')) {
    db.exec('ALTER TABLE photos ADD COLUMN viewCount INTEGER NOT NULL DEFAULT 0')
  }

  // group_id is used now (tag groups); position/hidden/coverPhotoPath are
  // reserved for later tag features (custom ordering, hiding from the UI, a
  // tag cover photo) — added now so those don't need their own migration
  // later, left unused by any code path until built.
  const tagColumns = db.prepare('PRAGMA table_info(tag_metadata)').all() as { name: string }[]
  if (!tagColumns.some((column) => column.name === 'group_id')) {
    db.exec('ALTER TABLE tag_metadata ADD COLUMN group_id TEXT')
  }
  if (!tagColumns.some((column) => column.name === 'position')) {
    db.exec('ALTER TABLE tag_metadata ADD COLUMN position INTEGER')
  }
  if (!tagColumns.some((column) => column.name === 'hidden')) {
    db.exec('ALTER TABLE tag_metadata ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0')
  }
  if (!tagColumns.some((column) => column.name === 'cover_photo_path')) {
    db.exec('ALTER TABLE tag_metadata ADD COLUMN cover_photo_path TEXT')
  }
  // True once a tag's group_id was set by an explicit user action (drag-and-
  // drop) rather than a group's auto-add rule — reconciliation leaves a
  // pinned tag's group alone even if it also matches some rule, so manually
  // moving a tag always wins over a rule, permanently.
  if (!tagColumns.some((column) => column.name === 'group_pinned')) {
    db.exec('ALTER TABLE tag_metadata ADD COLUMN group_pinned INTEGER NOT NULL DEFAULT 0')
  }

  // Case-insensitive substring a tag must contain to be auto-added to this
  // group (e.g. "vintage" matches any tag containing it) — null/empty means
  // no rule. Reconciliation (see tagMetadataRepository.reconcileTagGroups)
  // evaluates rules in position order, first match wins, and never
  // overrides a pinned tag.
  const groupColumns = db.prepare('PRAGMA table_info(tag_groups)').all() as { name: string }[]
  if (!groupColumns.some((column) => column.name === 'match_pattern')) {
    db.exec('ALTER TABLE tag_groups ADD COLUMN match_pattern TEXT')
  }

  // Bumping THUMBNAIL_GENERATION (e.g. after changing thumbnailService's target
  // size) marks every cached thumbnail stale so the next scan regenerates them
  // at the new size, without needing a full library rescan or cache wipe.
  // Bumped to 3: generateThumbnail now auto-orients via EXIF before resizing,
  // so previously-cached thumbnails for rotated photos were baked in the
  // wrong orientation and need to be regenerated once.
  // Bumped to 4: generateThumbnail now normalizes to sRGB, since a
  // grayscale/CMYK/unusual-ICC-profile source otherwise carried an ambiguous
  // colourspace into the thumbnail, crashing the AI embedding pipeline's
  // raw-buffer resize with a libvips "colourspace: parameter space not set"
  // error on some photos.
  const THUMBNAIL_GENERATION = '4'
  const storedGeneration = db
    .prepare("SELECT value FROM settings WHERE key = 'thumbnailGeneration'")
    .get() as { value: string } | undefined
  if (storedGeneration?.value !== THUMBNAIL_GENERATION) {
    db.exec("UPDATE photos SET thumbnailStatus = 'pending', thumbnailKey = NULL")
    db.prepare(
      `INSERT INTO settings (key, value) VALUES ('thumbnailGeneration', @value)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run({ value: THUMBNAIL_GENERATION })
  }

  return db
}
