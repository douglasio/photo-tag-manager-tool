import { ipcMain } from 'electron'

import { findByPath } from '@main/db/photoRepository'
import { ensureModelReady, suggestTags } from '@main/services/tagSuggestionService'
import { thumbnailFilePath } from '@main/services/thumbnailService'
import type { TagSuggestion } from '@shared/types'

export function registerAiHandlers(): void {
  // Downloads (first time only) and loads the CLIP model — invoked by the
  // Settings toggle when turning the feature on, streaming progress back to
  // that same renderer call's sender.
  ipcMain.handle('ai:ensureModelReady', async (event): Promise<void> => {
    await ensureModelReady((progress) => {
      event.sender.send('ai:downloadProgress', progress)
    })
  })

  ipcMain.handle(
    'ai:suggestTags',
    async (_event, filePath: string, candidateLabels: string[]): Promise<TagSuggestion[]> => {
      const found = findByPath(filePath)
      if (!found?.record.thumbnailKey) return []
      const imagePath = await thumbnailFilePath(found.record.thumbnailKey)
      return suggestTags(imagePath, candidateLabels)
    }
  )
}
