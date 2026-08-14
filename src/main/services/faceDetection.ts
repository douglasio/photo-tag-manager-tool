import { hasFacesForPhoto, insertFace } from '@main/db/faceRepository'
import { findAllReadyPhotos } from '@main/db/photoRepository'

import { detectFacesInImage } from './faceDetectionService'

const PROGRESS_INTERVAL_MS = 150

/** Detects+embeds faces for every ready photo that hasn't been scanned yet
 * (see faceRepository.hasFacesForPhoto), inserting one photo_faces row per
 * detected face. Mirrors photoEmbedding.ts's embedAllReadyPhotos: skip-on-
 * error per photo (a corrupt/unreadable file doesn't abort the whole scan),
 * throttled progress, polled cancellation. */
export async function detectAllReadyPhotoFaces(
  onProgress?: (done: number, total: number) => void,
  isCancelled?: () => boolean
): Promise<{ photosScanned: number; facesDetected: number }> {
  const photos = findAllReadyPhotos()
  let lastProgressAt = 0
  let photosScanned = 0
  let facesDetected = 0

  for (let i = 0; i < photos.length; i++) {
    if (isCancelled?.()) break
    const { filePath } = photos[i]

    if (!hasFacesForPhoto(filePath)) {
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
      } catch (err) {
        console.error(`Face detection failed for ${filePath}`, err)
      }
    }

    photosScanned++
    const now = Date.now()
    if (onProgress && now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
      lastProgressAt = now
      onProgress(i + 1, photos.length)
    }
  }

  onProgress?.(photosScanned, photos.length)
  return { photosScanned, facesDetected }
}
