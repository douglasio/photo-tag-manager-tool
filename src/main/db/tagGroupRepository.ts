import type { TagGroup } from '@shared/types'

import { getDb } from './database'

export function getTagGroups(): TagGroup[] {
  return getDb()
    .prepare(
      'SELECT id, name, position, match_pattern AS matchPattern FROM tag_groups ORDER BY position'
    )
    .all() as TagGroup[]
}

export function createTagGroup(name: string, matchPattern: string | null = null): TagGroup {
  const db = getDb()
  const { maxPosition } = db
    .prepare('SELECT MAX(position) AS maxPosition FROM tag_groups')
    .get() as { maxPosition: number | null }

  const group: TagGroup = {
    id: crypto.randomUUID(),
    name,
    position: (maxPosition ?? -1) + 1,
    matchPattern: matchPattern?.trim() || null
  }
  db.prepare(
    `INSERT INTO tag_groups (id, name, position, match_pattern)
     VALUES (@id, @name, @position, @matchPattern)`
  ).run(group)
  return group
}

export function renameTagGroup(id: string, name: string): void {
  getDb().prepare('UPDATE tag_groups SET name = ? WHERE id = ?').run(name, id)
}

export function setTagGroupMatchPattern(id: string, matchPattern: string | null): void {
  getDb()
    .prepare('UPDATE tag_groups SET match_pattern = ? WHERE id = ?')
    .run(matchPattern?.trim() || null, id)
}

/** Un-groups the group's tags (they fall back to "Other Tags") and clears
 * their pinned flag — deleting the group is a different action from a user
 * dragging a tag out, so its former tags become eligible for another
 * group's auto-add rule again rather than staying permanently un-groupable.
 * Never deletes the tags themselves. */
export function deleteTagGroup(id: string): void {
  const db = getDb()
  db.prepare('UPDATE tag_metadata SET group_id = NULL, group_pinned = 0 WHERE group_id = ?').run(id)
  db.prepare('DELETE FROM tag_groups WHERE id = ?').run(id)
}
