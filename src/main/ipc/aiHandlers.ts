import { ipcMain } from 'electron'

import { dismissDuplicateGroup } from '@main/db/duplicateRepository'
import { findByPath } from '@main/db/photoRepository'
import {
  cancelAiScan,
  enableAiFeaturesAndScan,
  runFullAiScan,
  wasAiScanInterrupted
} from '@main/services/aiScanService'
import { findSimilarPhotos } from '@main/services/duplicatePhotoService'
import { suggestTagsByExemplar } from '@main/services/tagExemplarService'
import { suggestTags } from '@main/services/tagSuggestionService'
import { thumbnailFilePath } from '@main/services/thumbnailService'
import { computeDuplicateGroupSignature } from '@shared/duplicateGroupSignature'
import type { AiScanResult, SimilarPhoto, TagSuggestion } from '@shared/types'

export function registerAiHandlers(): void {
  // The one call that takes AI features from off to fully scanned: downloads
  // the model (streaming 'downloading' progress), enables the setting, then
  // runs the shared scan (streaming 'embedding'/'clustering' progress) that
  // warms tag suggestions, duplicate detection, and Time Warp all at once —
  // triggerable from Settings, the Time Warp widget, or the Duplicates tab.
  ipcMain.handle('ai:enableAndScan', async (event): Promise<AiScanResult> => {
    return enableAiFeaturesAndScan((progress) => event.sender.send('ai:scanProgress', progress))
  })

  // Re-runs the shared scan (no model download — AI is already enabled),
  // e.g. "Scan again" on the Duplicates tab, or Time Warp picking up
  // newly-added photos.
  ipcMain.handle('ai:rescan', async (event): Promise<AiScanResult> => {
    return runFullAiScan((progress) => event.sender.send('ai:scanProgress', progress))
  })

  ipcMain.handle('ai:cancelScan', (): void => {
    cancelAiScan()
  })

  ipcMain.handle('ai:wasScanInterrupted', (): boolean => wasAiScanInterrupted())

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

  ipcMain.handle(
    'ai:findSimilarPhotos',
    async (_event, filePath: string, limit: number): Promise<SimilarPhoto[]> => {
      const found = findByPath(filePath)
      if (!found?.record.thumbnailKey) return []
      return findSimilarPhotos(filePath, found.record.thumbnailKey, limit)
    }
  )

  // Persists so the group stays hidden across rescans/restarts — clusterDuplicates
  // filters against this same signature every time it runs.
  ipcMain.handle('ai:dismissDuplicateGroup', (_event, filePaths: string[]): void => {
    dismissDuplicateGroup(computeDuplicateGroupSignature(filePaths))
  })
}
