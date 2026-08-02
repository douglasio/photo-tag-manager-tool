import { ipcMain } from 'electron'
import pLimitImport from 'p-limit'

import { findByPath } from '@main/db/photoRepository'
import {
  createTagGroup,
  deleteTagGroup,
  getTagGroups,
  renameTagGroup,
  setTagGroupMatchPattern
} from '@main/db/tagGroupRepository'
import {
  deleteTagMetadata,
  getAllTagDescriptions,
  getAllTagGroupAssignments,
  reconcileTagGroups,
  renameTagMetadata,
  setTagDescription,
  setTagGroupAssignment
} from '@main/db/tagMetadataRepository'
import { writeTags } from '@main/services/metadataService'
import { ingestFile } from '@main/services/photoIngest'
import { suppressNextEvent } from '@main/services/watchManager'
import type { PhotoRecord, TagGroup } from '@shared/types'

// p-limit is ESM-only; when externalized in the main-process CJS bundle,
// `require('p-limit')` yields the module namespace object rather than the
// callable default export, so it must be unwrapped explicitly.
const pLimit =
  (pLimitImport as unknown as { default?: typeof pLimitImport }).default ?? pLimitImport

const TAG_BATCH_CONCURRENCY = 4

export function registerTagHandlers(): void {
  ipcMain.handle(
    'tags:update',
    async (_event, filePath: string, tags: string[]): Promise<PhotoRecord> => {
      // Without this, the watcher's own independent re-ingest of the file
      // (triggered by the write's mtime change) races this handler's
      // explicit ingestFile below — and, worse, races the *next* tag write
      // if the user saves several tags in quick succession. exiftool's
      // -overwrite_original write is a temp-file-then-rename-over-original;
      // POSIX tolerates renaming over a file another process has open, but
      // Windows/NTFS generally doesn't, so that race only actually fails
      // there.
      suppressNextEvent(filePath)
      await writeTags(filePath, tags)
      // Single-file, user-triggered edit — no concurrency to limit, so just run it inline.
      const { photo } = await ingestFile(filePath, (fn) => fn())
      // This edit alone (not just a photo/row removal) can drop some other
      // tag's usage to zero, or introduce a tag a group's rule should match.
      reconcileTagGroups()
      return photo
    }
  )

  ipcMain.handle('tags:getDescriptions', (): Record<string, string> => getAllTagDescriptions())

  ipcMain.handle('tags:setDescription', (_event, tag: string, description: string): void => {
    setTagDescription(tag, description)
  })

  ipcMain.handle(
    'tags:rename',
    async (_event, oldTag: string, newTag: string, filePaths: string[]): Promise<PhotoRecord[]> => {
      const limit = pLimit(TAG_BATCH_CONCURRENCY)
      const photos = await Promise.all(
        filePaths.map((filePath) =>
          limit(async () => {
            const currentTags = findByPath(filePath)?.record.tags ?? []
            const nextTags = Array.from(
              new Set(currentTags.map((tag) => (tag === oldTag ? newTag : tag)))
            )
            suppressNextEvent(filePath)
            await writeTags(filePath, nextTags)
            const { photo } = await ingestFile(filePath, (fn) => fn())
            return photo
          })
        )
      )

      // Carries the whole metadata row (description, group membership, ...)
      // forward under the new name — a rename looks identical to
      // "old tag deleted, new tag created" from allTags' perspective, so
      // generic pruning alone can't preserve group membership across it.
      renameTagMetadata(oldTag, newTag)
      return photos
    }
  )

  ipcMain.handle(
    'tags:addBatch',
    async (_event, tagsToAdd: string[], filePaths: string[]): Promise<PhotoRecord[]> => {
      const limit = pLimit(TAG_BATCH_CONCURRENCY)
      const photos = await Promise.all(
        filePaths.map((filePath) =>
          limit(async () => {
            const currentTags = findByPath(filePath)?.record.tags ?? []
            const nextTags = Array.from(new Set([...currentTags, ...tagsToAdd]))
            suppressNextEvent(filePath)
            await writeTags(filePath, nextTags)
            const { photo } = await ingestFile(filePath, (fn) => fn())
            return photo
          })
        )
      )

      // A newly-added tag may match a group's auto-add rule.
      reconcileTagGroups()
      return photos
    }
  )

  ipcMain.handle(
    'tags:delete',
    async (_event, tag: string, filePaths: string[]): Promise<PhotoRecord[]> => {
      const limit = pLimit(TAG_BATCH_CONCURRENCY)
      const photos = await Promise.all(
        filePaths.map((filePath) =>
          limit(async () => {
            const currentTags = findByPath(filePath)?.record.tags ?? []
            const nextTags = currentTags.filter((t) => t !== tag)
            suppressNextEvent(filePath)
            await writeTags(filePath, nextTags)
            const { photo } = await ingestFile(filePath, (fn) => fn())
            return photo
          })
        )
      )

      deleteTagMetadata(tag)
      return photos
    }
  )

  ipcMain.handle(
    'tags:getGroupsData',
    (): { groups: TagGroup[]; assignments: Record<string, string> } => ({
      groups: getTagGroups(),
      assignments: getAllTagGroupAssignments()
    })
  )

  ipcMain.handle(
    'tags:createGroup',
    (_event, name: string, matchPattern: string | null): TagGroup => {
      const group = createTagGroup(name, matchPattern)
      // A rule set at creation time should immediately sweep in matching tags.
      if (group.matchPattern) reconcileTagGroups()
      return group
    }
  )

  ipcMain.handle('tags:renameGroup', (_event, id: string, name: string): void => {
    renameTagGroup(id, name)
  })

  ipcMain.handle(
    'tags:setGroupMatchPattern',
    (_event, id: string, matchPattern: string | null): void => {
      setTagGroupMatchPattern(id, matchPattern)
      reconcileTagGroups()
    }
  )

  ipcMain.handle('tags:deleteGroup', (_event, id: string): void => {
    deleteTagGroup(id)
  })

  ipcMain.handle('tags:setGroupAssignment', (_event, tag: string, groupId: string | null): void => {
    setTagGroupAssignment(tag, groupId)
  })
}
