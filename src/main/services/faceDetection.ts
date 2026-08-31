import { insertFace } from '@main/db/faceRepository'
import {
  findReadyPhotosWithoutFaceScan,
  markFaceScanned,
  photoExists
} from '@main/db/photoRepository'

import { detectFacesInImage } from './faceDetectionService'

const PROGRESS_INTERVAL_MS = 150

// Detects+embeds faces for every ready photo that hasn't been scanned yet
export async function detectAllReadyPhotoFaces(
  onProgress?: (done: number, total: number) => void,
  isCancelled?: () => boolean
): Promise<{ photosScanned: number; facesDetected: number }> {
  const photos = findReadyPhotosWithoutFaceScan()
  let lastProgressAt = 0
  let photosScanned = 0
  let facesDetected = 0

  for (let i = 0; i < photos.length; i++) {
    if (isCancelled?.()) break
    const { filePath } = photos[i]

    // The photo list is a snapshot from before this loop started — a folder
    // removed mid-scan deletes its rows, but this array still holds them.
    // Skipping the detect here stops removal from resurrecting faces for a
    // path no longer in the photos table. Progress below still advances by
    // loop position, not photosScanned, so it keeps reaching 100%.
    if (photoExists(filePath)) {
      try {
        const faces = await detectFacesInImage(filePath)
        for (const face of faces) {
          insertFace({
            photoPath: filePath,
            box: face.box,
            embedding: Float32Array.from(face.embedding)
          })
          facesDetected++
        }
        // Marked only on success — a photo that threw stays queued so a later
        // pass retries it, rather than being silently skipped forever.
        markFaceScanned(filePath)
      } catch (err) {
        console.error(`Face detection failed for ${filePath}`, err)
      }

      photosScanned++
    }

    const now = Date.now()
    if (onProgress && now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
      lastProgressAt = now
      onProgress(i + 1, photos.length)
    }
  }

  onProgress?.(photosScanned, photos.length)
  return { photosScanned, facesDetected }
}
