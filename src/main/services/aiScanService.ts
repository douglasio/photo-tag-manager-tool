import {
  getAiScanInProgress,
  getAiTagSuggestionsEnabled,
  setAiScanInProgress,
  setAiTagSuggestionsEnabled
} from '@main/db/settingsRepository'
import type { AiScanProgress, AiScanResult } from '@shared/types'

import { clusterDuplicates } from './duplicatePhotoService'
import { embedAllReadyPhotos } from './photoEmbedding'
import { disposeTagSuggestionWorker, ensureModelReady } from './tagSuggestionService'

// Single shared in-flight scan (Settings, the Time Warp widget, or the Duplicates tab)
let currentScan: { cancelled: boolean } | null = null

// True only between starting the model download and either it finishing runFullAiScan taking over
let downloading = false
let downloadCancelRequested = false

// Warms the shared embedding cache for every ready photo, then clusters duplicates
export async function runFullAiScan(
  onProgress?: (progress: AiScanProgress) => void
): Promise<AiScanResult> {
  const scan = { cancelled: false }
  currentScan = scan
  setAiScanInProgress(true)
  try {
    const embedded = await embedAllReadyPhotos(
      (done, total) => onProgress?.({ phase: 'embedding', done, total }),
      () => scan.cancelled
    )
    if (scan.cancelled) {
      return { duplicateGroups: [], photosScanned: embedded.length, canceled: true }
    }

    const { groups, canceled } = await clusterDuplicates(
      embedded,
      (comparisons, totalPairs) => {
        const pct = totalPairs > 0 ? Math.round((comparisons / totalPairs) * 100) : 100
        onProgress?.({ phase: 'clustering', done: pct, total: 100 })
      },
      () => scan.cancelled
    )
    return { duplicateGroups: groups, photosScanned: embedded.length, canceled }
  } finally {
    if (currentScan === scan) currentScan = null
    setAiScanInProgress(false)
  }
}

// Downloads the model (streaming 'downloading' progress), enables the setting, then runs the shared scan
export async function enableAiFeaturesAndScan(
  onProgress?: (progress: AiScanProgress) => void
): Promise<AiScanResult> {
  downloading = true
  downloadCancelRequested = false
  try {
    await ensureModelReady((progress) => {
      onProgress?.({ phase: 'downloading', done: progress, total: 100 })
    })
  } catch (err) {
    downloading = false
    if (downloadCancelRequested) {
      return { duplicateGroups: [], photosScanned: 0, canceled: true }
    }
    throw err
  }
  downloading = false
  setAiTagSuggestionsEnabled(true)
  return runFullAiScan(onProgress)
}

export function cancelAiScan(): void {
  if (currentScan) {
    currentScan.cancelled = true
    return
  }
  if (downloading) {
    // killing the worker is the only way to actually stop it
    downloadCancelRequested = true
    void disposeTagSuggestionWorker()
  }
}

// resume interrupted scan on app relaunch
export function wasAiScanInterrupted(): boolean {
  return getAiTagSuggestionsEnabled() && getAiScanInProgress()
}
