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

// Single shared in-flight scan, mirroring the pattern throwbackHandlers.ts
// used to own privately for its own copy of this scan — centralizing it
// here is what lets Cancel work regardless of where the scan was started
// (Settings, the Time Warp widget, or the Duplicates tab).
let currentScan: { cancelled: boolean } | null = null

// True only between starting the model download and either it finishing or
// runFullAiScan taking over — the window during which currentScan is still
// null, so cancelAiScan() needs a second signal to know Cancel should abort
// the download instead of a (nonexistent) scan.
let downloading = false
let downloadCancelRequested = false

// Warms the shared embedding cache for every ready photo (which is what
// both tag suggestions and Time Warp read from), then clusters duplicates —
// the one orchestration point "enabling AI features" runs, instead of each
// feature triggering its own separate scan.
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

// Downloads the model (streaming 'downloading' progress), enables the
// setting, then runs the shared scan — the one call Settings, the Time Warp
// widget, and the Duplicates tab all use to go from off to fully scanned.
// Lives here rather than in the IPC handler so cancellation during the
// download phase — which runFullAiScan alone can't see — is handled by the
// same cancelAiScan() as everything else.
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
    // transformers.js's pipeline() download exposes no AbortSignal — killing
    // the worker is the only way to actually stop it. disposeTagSuggestionWorker
    // rejects the ensureModelReady() promise above, which is what unblocks
    // enableAiFeaturesAndScan immediately instead of leaving it hanging.
    downloadCancelRequested = true
    void disposeTagSuggestionWorker()
  }
}

// If this is still true on launch (and AI is enabled), the previous scan was
// cut off by a quit rather than finishing/being canceled — safe to silently
// resume since embeddings already computed are cached in the DB.
export function wasAiScanInterrupted(): boolean {
  return getAiTagSuggestionsEnabled() && getAiScanInProgress()
}
