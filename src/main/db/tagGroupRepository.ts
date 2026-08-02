import type { TagGroup } from '@shared/types'

import { getDb } from './database'

export function getTagGroups(): TagGroup[] {
  return getDb()
    .prepare('SELECT id, name, position FROM tag_groups ORDER BY position')
    .all() as TagGroup[]
}

export function createTagGroup(name: string): TagGroup {
  const db = getDb()
  const { maxPosition } = db
    .prepare('SELECT MAX(position) AS maxPosition FROM tag_groups')
    .get() as { maxPosition: number | null }

  const group: TagGroup = {
    id: crypto.randomUUID(),
    name,
    position: (maxPosition ?? -1) + 1
  }
  db.prepare('INSERT INTO tag_groups (id, name, position) VALUES (@id, @name, @position)').run(
    group
  )
  return group
}

export function renameTagGroup(id: string, name: string): void {
  getDb().prepare('UPDATE tag_groups SET name = ? WHERE id = ?').run(name, id)
}

/** Un-groups the group's tags (they fall back to "Other Tags") before
 * removing the group row — never deletes the tags themselves. */
export function deleteTagGroup(id: string): void {
  const db = getDb()
  db.prepare('UPDATE tag_metadata SET group_id = NULL WHERE group_id = ?').run(id)
  db.prepare('DELETE FROM tag_groups WHERE id = ?').run(id)
}
