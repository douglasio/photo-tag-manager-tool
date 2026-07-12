import { ipcMain } from 'electron'
import { writeTags } from '../services/metadataService'
import { ingestFile } from '../services/photoIngest'
import type { PhotoRecord } from '../../shared/types'

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
}
