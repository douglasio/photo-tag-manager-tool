import { ipcMain } from 'electron'

import { findByPath } from '@main/db/photoRepository'
import { findDuplicateGroups, findSimilarPhotos } from '@main/services/duplicatePhotoService'
import { suggestTagsByExemplar } from '@main/services/tagExemplarService'
import { ensureModelReady, suggestTags } from '@main/services/tagSuggestionService'
import { thumbnailFilePath } from '@main/services/thumbnailService'
import type { DuplicateGroup, SimilarPhoto, TagSuggestion } from '@shared/types'

export function registerAiHandlers(): void {
  // Downloads (first time only) and loads the CLIP model — invoked by the
  // Settings toggle when turning the feature on, streaming progress back to
  // that same renderer call's sender.
  ipcMain.handle('ai:ensureModelReady', async (event): Promise<void> => {
    await ensureModelReady((progress) => {
      event.sender.send('ai:downloadProgress', progress)
    })
  })

  // Blends zero-shot text matching (works from day one) with similarity to a
  // tag's own tagged photos (more personalized) — exemplar wins where both apply.
  ipcMain.handle(
    'ai:suggestTags',
    async (_event, filePath: string, candidateLabels: string[]): Promise<TagSuggestion[]> => {
      const found = findByPath(filePath)
      if (!found?.record.thumbnailKey) return []
      const thumbnailKey = found.record.thumbnailKey
      const imagePath = await thumbnailFilePath(thumbnailKey)

      const [zeroShotResults, exemplarResults] = await Promise.all([
        suggestTags(imagePath, candidateLabels),
        suggestTagsByExemplar(filePath, thumbnailKey, candidateLabels)
      ])

      const exemplarTags = new Set(exemplarResults.map((result) => result.tag))
      const zeroShotOnly = zeroShotResults.filter((result) => !exemplarTags.has(result.tag))

      return [...exemplarResults, ...zeroShotOnly]
    }
  )

  // Streams progress back to the same call's sender, same pattern as
  // ai:ensureModelReady's download progress.
  ipcMain.handle('ai:findDuplicateGroups', async (event): Promise<DuplicateGroup[]> => {
    return findDuplicateGroups((progress) => {
      event.sender.send('ai:duplicateProgress', progress)
    })
  })

  ipcMain.handle(
    'ai:findSimilarPhotos',
    async (_event, filePath: string, limit: number): Promise<SimilarPhoto[]> => {
      const found = findByPath(filePath)
      if (!found?.record.thumbnailKey) return []
      return findSimilarPhotos(filePath, found.record.thumbnailKey, limit)
    }
  )
}
