import { getPeople } from '@main/db/faceRepository'
import { setFaceDetectionEnabled } from '@main/db/settingsRepository'
import type { FaceScanProgress, FaceScanResult } from '@shared/types'

import { runFaceClustering } from './faceClustering'
import { detectAllReadyPhotoFaces } from './faceDetection'
import { ensureFaceModelReady } from './faceDetectionService'
import { resumeFaceIndexer, stopFaceIndexer } from './faceIndexService'

// Single shared cancellable in-flight scan
let currentScan: { cancelled: boolean } | null = null
// Re-entrancy guard: a second scan started while one is running would drive
// the same detection/clustering workers concurrently and double the memory
// footprint, so callers share the in-flight scan instead.
let inFlightScan: Promise<FaceScanResult> | null = null

export async function runFullFaceScan(
  onProgress?: (progress: FaceScanProgress) => void
): Promise<FaceScanResult> {
  if (inFlightScan) return inFlightScan
  inFlightScan = runFullFaceScanUncoordinated(onProgress).finally(() => {
    inFlightScan = null
  })
  return inFlightScan
}

async function runFullFaceScanUncoordinated(
  onProgress?: (progress: FaceScanProgress) => void
): Promise<FaceScanResult> {
  const scan = { cancelled: false }
  currentScan = scan
  // Both this and the background indexer drive the same detection/clustering
  // workers — must not overlap. Awaited so the indexer's in-flight photo
  // (which can't be interrupted mid-inference) finishes first.
  await stopFaceIndexer()
  try {
    await ensureFaceModelReady()

    const { photosScanned, facesDetected } = await detectAllReadyPhotoFaces(
      (done, total) => onProgress?.({ phase: 'detecting', done, total }),
      () => scan.cancelled
    )
    if (scan.cancelled) {
      return { facesDetected, peopleCount: getPeople().length, photosScanned, canceled: true }
    }

    onProgress?.({ phase: 'clustering', done: 0, total: 100 })
    const { canceled } = await runFaceClustering(() => scan.cancelled)
    onProgress?.({ phase: 'clustering', done: 100, total: 100 })

    return { facesDetected, peopleCount: getPeople().length, photosScanned, canceled }
  } finally {
    if (currentScan === scan) currentScan = null
    resumeFaceIndexer()
  }
}

export async function enableFaceDetectionAndScan(
  onProgress?: (progress: FaceScanProgress) => void
): Promise<FaceScanResult> {
  setFaceDetectionEnabled(true)
  return runFullFaceScan(onProgress)
}

export function cancelFaceScan(): void {
  if (currentScan) currentScan.cancelled = true
}
