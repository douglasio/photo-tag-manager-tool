import { getDb } from './database'

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

export function setTagDescription(tag: string, description: string): void {
  if (description.trim() === '') {
    getDb().prepare('DELETE FROM tag_metadata WHERE tag = ?').run(tag)
    return
  }

  getDb()
    .prepare(
      `INSERT INTO tag_metadata (tag, description) VALUES (@tag, @description)
       ON CONFLICT(tag) DO UPDATE SET description = excluded.description`
    )
    .run({ tag, description })
}

/** Moves a tag's description (if any) to a new tag name, used when a tag is renamed. */
export function renameTagDescription(oldTag: string, newTag: string): void {
  const db = getDb()
  const row = db.prepare('SELECT description FROM tag_metadata WHERE tag = ?').get(oldTag) as
    { description: string | null } | undefined

  db.prepare('DELETE FROM tag_metadata WHERE tag = ?').run(oldTag)
  if (!row?.description) return

  db.prepare(
    `INSERT INTO tag_metadata (tag, description) VALUES (@tag, @description)
     ON CONFLICT(tag) DO UPDATE SET description = excluded.description`
  ).run({ tag: newTag, description: row.description })
}
