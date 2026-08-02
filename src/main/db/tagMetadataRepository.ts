import { getDb } from './database'
import { getTagGroups } from './tagGroupRepository'

interface TagMetadataRow {
  tag: string
  description: string | null
  group_id: string | null
  position: number | null
  hidden: number
  cover_photo_path: string | null
}

const TAG_METADATA_COLUMNS = 'tag, description, group_id, position, hidden, cover_photo_path'

export function getAllTagDescriptions(): Record<string, string> {
  const rows = getDb().prepare('SELECT tag, description FROM tag_metadata').all() as {
    tag: string
    description: string | null
  }[]

  const result: Record<string, string> = {}
  for (const row of rows) {
    if (row.description) result[row.tag] = row.description
  }
  return result
}

// Upserts rather than deleting the row on an empty description — the row may
// carry other properties (group membership, etc.) that must survive a
// description being cleared. A row left with every column empty/default is
// harmless: every getter here already filters on its own column.
export function setTagDescription(tag: string, description: string): void {
  const value = description.trim() === '' ? null : description
  getDb()
    .prepare(
      `INSERT INTO tag_metadata (tag, description) VALUES (@tag, @description)
       ON CONFLICT(tag) DO UPDATE SET description = excluded.description`
    )
    .run({ tag, description: value })
}

/** Moves a tag's whole metadata row (description, group membership, and any
 * future per-tag property) to a new tag name, used when a tag is renamed.
 * If newTag already has a row (renaming into an existing tag name), the
 * old row's values win — same precedence this already had for description
 * alone before other columns existed on this table. */
export function renameTagMetadata(oldTag: string, newTag: string): void {
  const db = getDb()
  const row = db
    .prepare(`SELECT ${TAG_METADATA_COLUMNS} FROM tag_metadata WHERE tag = ?`)
    .get(oldTag) as TagMetadataRow | undefined
  if (!row) return

  db.prepare('DELETE FROM tag_metadata WHERE tag = ?').run(oldTag)
  db.prepare(
    `INSERT INTO tag_metadata (tag, description, group_id, position, hidden, cover_photo_path)
     VALUES (@tag, @description, @group_id, @position, @hidden, @cover_photo_path)
     ON CONFLICT(tag) DO UPDATE SET
       description = excluded.description,
       group_id = excluded.group_id,
       position = excluded.position,
       hidden = excluded.hidden,
       cover_photo_path = excluded.cover_photo_path`
  ).run({ ...row, tag: newTag })
}

/** Fully removes a tag's metadata row — used when the tag itself is deleted
 * (stripped from every photo), unlike setTagDescription's empty-value case
 * above which only clears one column. */
export function deleteTagMetadata(tag: string): void {
  getDb().prepare('DELETE FROM tag_metadata WHERE tag = ?').run(tag)
}

export function getAllTagGroupAssignments(): Record<string, string> {
  const rows = getDb()
    .prepare('SELECT tag, group_id FROM tag_metadata WHERE group_id IS NOT NULL')
    .all() as { tag: string; group_id: string }[]

  const result: Record<string, string> = {}
  for (const row of rows) result[row.tag] = row.group_id
  return result
}

/** Explicit (drag-and-drop) group assignment — pins the tag, so a group's
 * auto-add rule can never override this again (see reconcileTagGroups). */
export function setTagGroupAssignment(tag: string, groupId: string | null): void {
  getDb()
    .prepare(
      `INSERT INTO tag_metadata (tag, group_id, group_pinned) VALUES (@tag, @groupId, 1)
       ON CONFLICT(tag) DO UPDATE SET group_id = excluded.group_id, group_pinned = 1`
    )
    .run({ tag, groupId })
}

/** The set of tags currently applied to at least one photo, computed
 * directly from photos.tags (a JSON array column) via SQLite's json_each —
 * the authoritative source `allTags` is derived from in the renderer, used
 * here so group-assignment cleanup doesn't need its own tracking of tag
 * usage. */
export function getUsedTags(): Set<string> {
  const rows = getDb()
    .prepare('SELECT DISTINCT je.value AS tag FROM photos, json_each(photos.tags) je')
    .all() as { tag: string }[]
  return new Set(rows.map((row) => row.tag))
}

/** Keeps tag_metadata.group_id in sync with reality — two independent jobs
 * in one pass, both scoped to currently-used tags:
 *  - clears group_id for any tag no longer applied to any photo (never
 *    touches tag_groups itself, so a group stays around, even empty, until
 *    a user explicitly deletes it)
 *  - auto-assigns every unpinned tag to the first group (by position) whose
 *    match_pattern is a case-insensitive substring of it, or clears it back
 *    to ungrouped if nothing matches — pinned tags (set via
 *    setTagGroupAssignment, i.e. a manual drag) are left untouched
 * Call after anything that can change which tags are in use, or after a
 * group's own match_pattern changes (see call sites in
 * photoRepository/watchManager/tagHandlers/tagGroupRepository). */
export function reconcileTagGroups(): void {
  const db = getDb()
  const usedTags = getUsedTags()
  const ruledGroups = getTagGroups().filter((group) => group.matchPattern)
  const rows = db.prepare('SELECT tag, group_id, group_pinned FROM tag_metadata').all() as {
    tag: string
    group_id: string | null
    group_pinned: number
  }[]
  const rowByTag = new Map(rows.map((row) => [row.tag, row]))

  const setGroup = db.prepare('UPDATE tag_metadata SET group_id = ? WHERE tag = ?')
  const insertGroup = db.prepare(
    `INSERT INTO tag_metadata (tag, group_id) VALUES (@tag, @groupId)
     ON CONFLICT(tag) DO UPDATE SET group_id = excluded.group_id`
  )
  const clearGroup = db.prepare('UPDATE tag_metadata SET group_id = NULL WHERE tag = ?')

  const applyAll = db.transaction(() => {
    for (const tag of usedTags) {
      const row = rowByTag.get(tag)
      if (row?.group_pinned) continue

      const matched = ruledGroups.find((group) =>
        tag.toLowerCase().includes(group.matchPattern!.toLowerCase())
      )
      const nextGroupId = matched?.id ?? null
      const currentGroupId = row?.group_id ?? null
      if (nextGroupId === currentGroupId) continue

      if (row) setGroup.run(nextGroupId, tag)
      else if (nextGroupId) insertGroup.run({ tag, groupId: nextGroupId })
    }

    for (const row of rows) {
      if (row.group_id && !usedTags.has(row.tag)) clearGroup.run(row.tag)
    }
  })
  applyAll()
}
