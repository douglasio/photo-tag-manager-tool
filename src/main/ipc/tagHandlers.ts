import { ipcMain } from 'electron'
import pLimitImport from 'p-limit'
import { writeTags } from '../services/metadataService'
import { ingestFile } from '../services/photoIngest'
import { findByPath } from '../db/photoRepository'
import {
  getAllTagDescriptions,
  setTagDescription,
  renameTagDescription
} from '../db/tagMetadataRepository'
import type { PhotoRecord } from '../../shared/types'

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
      await writeTags(filePath, tags)
      // Single-file, user-triggered edit — no concurrency to limit, so just run it inline.
      const { photo } = await ingestFile(filePath, (fn) => fn())
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
            await writeTags(filePath, nextTags)
            const { photo } = await ingestFile(filePath, (fn) => fn())
            return photo
          })
        )
      )

      renameTagDescription(oldTag, newTag)
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
            await writeTags(filePath, nextTags)
            const { photo } = await ingestFile(filePath, (fn) => fn())
            return photo
          })
        )
      )

      setTagDescription(tag, '')
      return photos
    }
  )
}
