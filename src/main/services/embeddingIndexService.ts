import type { WebContents } from 'electron'

import { findReadyPhotosWithoutEmbeddings } from '@main/db/photoRepository'
import { getAiTagSuggestionsEnabled } from '@main/db/settingsRepository'
import type { EmbeddingIndexProgress } from '@shared/types'

import { enterLane, exitLane, isLaneBusy } from './backgroundIndexLane'
import { getOrComputeEmbedding } from './photoEmbedding'

// Coalesces a burst of triggers (scan complete, several watcher upserts in a
// row) into one pass instead of re-querying on every single one.
const KICK_DEBOUNCE_MS = 3000
// Throttles the progress broadcast, same reasoning as photoEmbedding.ts's
// PROGRESS_INTERVAL_MS.
const PROGRESS_INTERVAL_MS = 150

let running = false
// True while a full AI scan (runFullAiScan) owns the shared CLIP worker —
// this module must never touch it at the same time.
let suspended = false
// Set when kickIndexer() is called while a pass is already running, so the
// running pass re-queries once it finishes instead of missing photos that
// landed mid-pass.
let rekickRequested = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let inFlightPass: Promise<void> | null = null
let currentStatus: EmbeddingIndexProgress | null = null
let indexTarget: WebContents | null = null

export function setIndexTarget(target: WebContents): void {
  indexTarget = target
}

function broadcastProgress(progress: EmbeddingIndexProgress | null): void {
  currentStatus = progress
  if (indexTarget && !indexTarget.isDestroyed()) {
    indexTarget.send('ai:indexProgress', progress)
  }
}

export function getIndexStatus(): EmbeddingIndexProgress | null {
  return currentStatus
}

async function runPass(): Promise<void> {
  running = true
  enterLane()
  try {
    let photos = findReadyPhotosWithoutEmbeddings()
    while (photos.length > 0 && !suspended) {
      const total = photos.length
      let lastProgressAt = 0
      for (let i = 0; i < photos.length; i++) {
        if (suspended) break
        try {
          await getOrComputeEmbedding(photos[i].filePath, photos[i].thumbnailKey)
        } catch (err) {
          console.error(`failed to embed ${photos[i].filePath}, skipping`, err)
        }
        const done = i + 1
        const now = Date.now()
        if (done === total || now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
          lastProgressAt = now
          broadcastProgress({ done, total })
        }
      }
      if (suspended || !rekickRequested) break
      rekickRequested = false
      photos = findReadyPhotosWithoutEmbeddings()
    }
  } finally {
    exitLane()
    running = false
    broadcastProgress(null)
  }
}

/** Debounced entry point — safe to call on every scan-complete/watcher-upsert
 * event. No-ops while suspended (a full AI scan owns the worker) or while AI
 * features are off; coalesces bursts via the debounce, and re-queries after
 * an already-running pass finishes rather than starting a second one. */
export function kickIndexer(): void {
  if (suspended) return
  if (running) {
    rekickRequested = true
    return
  }
  if (!getAiTagSuggestionsEnabled()) return

  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    if (suspended || !getAiTagSuggestionsEnabled()) return
    // The other indexer holds the lane — re-arm rather than run alongside it.
    if (isLaneBusy()) {
      kickIndexer()
      return
    }
    inFlightPass = runPass().finally(() => {
      inFlightPass = null
    })
  }, KICK_DEBOUNCE_MS)
}

/** Halts the indexer for the duration of a full AI scan, awaiting the
 * in-flight photo (inference can't be interrupted mid-call) before
 * resolving. Must be called before the scan touches the shared CLIP worker. */
export async function stopIndexer(): Promise<void> {
  suspended = true
  rekickRequested = false
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (inFlightPass) await inFlightPass
}

/** Re-arms the indexer once a full AI scan finishes and immediately kicks it
 * — typically a no-op pass, since the scan just embedded everything itself,
 * but this also picks up anything that landed while suspended. */
export function resumeIndexer(): void {
  suspended = false
  kickIndexer()
}
