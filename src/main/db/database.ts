import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

export function getDbPath(): string {
  return join(app.getPath('userData'), 'photag.db')
}

export function getDb(): Database.Database {
  if (db) return db

  db = new Database(getDbPath())
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

  // A dismissed duplicate group ("these aren't actually duplicates") is
  // keyed by its own sorted, joined file paths — groups have no other stable
  // ID since clustering recomputes them fresh every scan — so a rescan or
  // app restart still knows to hide it.
  db.exec(`
    CREATE TABLE IF NOT EXISTS dismissed_duplicate_groups (
      signature TEXT PRIMARY KEY,
      dismissedAt INTEGER NOT NULL
    )
  `)

  // A person is its own entity, deliberately separate from tags — grouped
  // faces get labeled here rather than folded into the tag system. name is
  // null until the user labels it ("Unnamed person" in the UI).
  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT,
      cover_face_id TEXT,
      created_at INTEGER NOT NULL
    )
  `)

  // One row per detected face. person_id_pinned mirrors
  // tag_metadata.group_pinned: set to 1 only by an explicit user action
  // (manual assign/merge/split), and the clustering pass skips any pinned
  // face permanently, the same way reconcileTagGroups skips a pinned tag.
  db.exec(`
    CREATE TABLE IF NOT EXISTS photo_faces (
      id TEXT PRIMARY KEY,
      photo_path TEXT NOT NULL,
      box_x REAL NOT NULL,
      box_y REAL NOT NULL,
      box_w REAL NOT NULL,
      box_h REAL NOT NULL,
      embedding BLOB NOT NULL,
      person_id TEXT,
      person_id_pinned INTEGER NOT NULL DEFAULT 0,
      detected_at INTEGER NOT NULL
    )
  `)
  db.exec('CREATE INDEX IF NOT EXISTS idx_photo_faces_photo_path ON photo_faces(photo_path)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_photo_faces_person_id ON photo_faces(person_id)')

  // hidden: set by the "Hide" person action — filtered out of the People
  // panel/gallery filter, but the person row (and its pinned faces) stay in
  // the DB so it can be un-hidden from Settings. description: same free-text
  // pattern as tag_metadata.description.
  const peopleColumns = db.prepare('PRAGMA table_info(people)').all() as { name: string }[]
  if (!peopleColumns.some((column) => column.name === 'hidden')) {
    db.exec('ALTER TABLE people ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0')
  }
  if (!peopleColumns.some((column) => column.name === 'description')) {
    db.exec('ALTER TABLE people ADD COLUMN description TEXT')
  }

  const photoColumns = db.prepare('PRAGMA table_info(photos)').all() as { name: string }[]
  if (!photoColumns.some((column) => column.name === 'comment')) {
    db.exec('ALTER TABLE photos ADD COLUMN comment TEXT')
  }
  if (!photoColumns.some((column) => column.name === 'viewCount')) {
    db.exec('ALTER TABLE photos ADD COLUMN viewCount INTEGER NOT NULL DEFAULT 0')
  }
  // Set once on true INSERT only (unlike lastScannedAt) — a durable
  // "recently added" signal. Existing rows get lastScannedAt as a one-time approximation.
  if (!photoColumns.some((column) => column.name === 'firstSeenAt')) {
    db.exec('ALTER TABLE photos ADD COLUMN firstSeenAt INTEGER')
    db.exec('UPDATE photos SET firstSeenAt = lastScannedAt WHERE firstSeenAt IS NULL')
  }
  // When face detection last ran for this photo. Needed because a photo with
  // zero faces leaves no photo_faces rows, so it is otherwise indistinguishable
  // from a never-scanned one and gets fully re-detected on every scan.
  // Backfilled for photos that already have faces; the rest are re-detected once.
  if (!photoColumns.some((column) => column.name === 'faceScannedAt')) {
    db.exec('ALTER TABLE photos ADD COLUMN faceScannedAt INTEGER')
    db.exec(
      `UPDATE photos SET faceScannedAt = lastScannedAt
       WHERE path IN (SELECT DISTINCT photo_path FROM photo_faces)`
    )
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

// Closes the live connection so its file can be safely deleted or replaced
// out from under it (importing/clearing the library) — the next getDb()
// call transparently reopens (and re-migrates, if needed) from disk.
export function closeDb(): void {
  db?.close()
  db = null
}
