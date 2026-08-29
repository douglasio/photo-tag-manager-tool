import type { WebContents } from 'electron'

import { insertFace } from '@main/db/faceRepository'
import { findReadyPhotosWithoutFaceScan, markFaceScanned } from '@main/db/photoRepository'
import { getFaceDetectionEnabled } from '@main/db/settingsRepository'
import type { FaceIndexProgress } from '@shared/types'

import { enterLane, exitLane, isLaneBusy } from './backgroundIndexLane'
import { runFaceClustering } from './faceClustering'
import { detectFacesInImage } from './faceDetectionService'

// Coalesces a burst of triggers (scan complete, several watcher upserts in a
// row) into one pass instead of re-querying on every single one.
const KICK_DEBOUNCE_MS = 3000
// Throttles the progress broadcast, same reasoning as faceDetection.ts's
// PROGRESS_INTERVAL_MS.
const PROGRESS_INTERVAL_MS = 150

let running = false
// True while a full face scan (runFullFaceScan) owns the shared detection and
// clustering workers — this module must never touch them at the same time.
let suspended = false
// Set when kickFaceIndexer() is called while a pass is already running, so the
// running pass re-queries once it finishes instead of missing photos that
// landed mid-pass.
let rekickRequested = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let inFlightPass: Promise<void> | null = null
let currentStatus: FaceIndexProgress | null = null
let indexTarget: WebContents | null = null

export function setFaceIndexTarget(target: WebContents): void {
  indexTarget = target
}

function broadcastProgress(progress: FaceIndexProgress | null): void {
  currentStatus = progress
  if (indexTarget && !indexTarget.isDestroyed()) {
    indexTarget.send('faces:indexProgress', progress)
  }
}

export function getFaceIndexStatus(): FaceIndexProgress | null {
  return currentStatus
}

async function runPass(): Promise<void> {
  running = true
  enterLane()
  try {
    let photos = findReadyPhotosWithoutFaceScan()
    while (photos.length > 0 && !suspended) {
      const total = photos.length
      let lastProgressAt = 0
      let facesFound = 0
      for (let i = 0; i < photos.length; i++) {
        if (suspended) break
        const { filePath } = photos[i]
        try {
          const faces = await detectFacesInImage(filePath)
          for (const face of faces) {
            insertFace({
              photoPath: filePath,
              box: face.box,
              embedding: Float32Array.from(face.embedding)
            })
            facesFound++
          }
          // Marked only on success — a photo that threw stays queued for a
          // later pass rather than being silently skipped forever.
          markFaceScanned(filePath)
        } catch (err) {
          console.error(`background face detection failed for ${filePath}, skipping`, err)
        }
        const done = i + 1
        const now = Date.now()
        if (done === total || now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
          lastProgressAt = now
          broadcastProgress({ done, total })
        }
      }

      // Newly detected faces are unassigned until clustering groups them, so
      // without this they'd never turn into people in the panel.
      if (facesFound > 0 && !suspended) {
        try {
          await runFaceClustering(() => suspended)
        } catch (err) {
          console.error('background face clustering failed', err)
        }
      }

      if (suspended || !rekickRequested) break
      rekickRequested = false
      photos = findReadyPhotosWithoutFaceScan()
    }
  } finally {
    exitLane()
    running = false
    broadcastProgress(null)
  }
}

/** Debounced entry point — safe to call on every scan-complete/watcher-upsert
 * event. No-ops while suspended (a full face scan owns the workers) or while
 * face detection is off; coalesces bursts via the debounce, and re-queries
 * after an already-running pass finishes rather than starting a second one. */
export function kickFaceIndexer(): void {
  if (suspended) return
  if (running) {
    rekickRequested = true
    return
  }
  if (!getFaceDetectionEnabled()) return

  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    if (suspended || !getFaceDetectionEnabled()) return
    // The other indexer holds the lane — re-arm rather than run alongside it.
    if (isLaneBusy()) {
      kickFaceIndexer()
      return
    }
    inFlightPass = runPass().finally(() => {
      inFlightPass = null
    })
  }, KICK_DEBOUNCE_MS)
}

/** Halts the indexer for the duration of a full face scan, awaiting the
 * in-flight photo (inference can't be interrupted mid-call) before resolving.
 * Must be called before the scan touches the shared workers. */
export async function stopFaceIndexer(): Promise<void> {
  suspended = true
  rekickRequested = false
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (inFlightPass) await inFlightPass
}

/** Re-arms the indexer once a full face scan finishes and immediately kicks
 * it — typically a no-op pass, since the scan just detected everything
 * itself, but this also picks up anything that landed while suspended. */
export function resumeFaceIndexer(): void {
  suspended = false
  kickFaceIndexer()
}
