import { getPeople } from '@main/db/faceRepository'
import { setFaceDetectionEnabled } from '@main/db/settingsRepository'
import type { FaceScanProgress, FaceScanResult } from '@shared/types'

import { runFaceClustering } from './faceClustering'
import { detectAllReadyPhotoFaces } from './faceDetection'
import { ensureFaceModelReady } from './faceDetectionService'

// Single shared in-flight scan, mirroring aiScanService.ts's currentScan —
// centralizing it here is what lets Cancel work regardless of where the
// scan was started.
let currentScan: { cancelled: boolean } | null = null

export async function runFullFaceScan(
  onProgress?: (progress: FaceScanProgress) => void
): Promise<FaceScanResult> {
  const scan = { cancelled: false }
  currentScan = scan
  try {
    // Bundled models, so this resolves near-instantly — no 'downloading'
    // phase to report, unlike aiScanService's CLIP-download flow.
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
