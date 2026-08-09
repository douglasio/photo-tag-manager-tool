import { getEmbedding, setEmbedding } from '@main/db/embeddingRepository'
import { findAllReadyPhotos } from '@main/db/photoRepository'

import { embedImage } from './tagSuggestionService'
import { thumbnailFilePath } from './thumbnailService'

// Shared by tagExemplarService and duplicatePhotoService — reads the cached
// embedding if there is one, otherwise computes and caches it.
export async function getOrComputeEmbedding(
  filePath: string,
  thumbnailKey: string
): Promise<number[]> {
  const cached = getEmbedding(filePath)
  if (cached) return Array.from(cached)

  const imagePath = await thumbnailFilePath(thumbnailKey)
  const embedding = await embedImage(imagePath)
  setEmbedding(filePath, Float32Array.from(embedding))
  return embedding
}

export interface EmbeddedPhoto {
  filePath: string
  thumbnailKey: string
  embedding: number[]
}

// Reporting on every single photo flooded the renderer with a progress
// dispatch (and a notification re-render) per photo — invisible on a small
// library, but enough on a large one to make the whole app feel locked up.
// Cancellation is checked every iteration regardless (cheap, and must stay
// responsive); only the onProgress call itself is throttled.
const PROGRESS_INTERVAL_MS = 150

// Embeds every not-yet-cached ready photo, reporting progress as it goes and
// checking isCancelled between photos — shared by duplicate detection (no
// cancellation) and the Throwback widget's opt-in "Time Warp" library scan
// (cancelable). Stops (rather than throws) partway through on cancellation,
// returning whatever was embedded so far; already-cached embeddings from a
// prior run/cancel are reused, not recomputed.
export async function embedAllReadyPhotos(
  onProgress?: (done: number, total: number) => void,
  isCancelled?: () => boolean
): Promise<EmbeddedPhoto[]> {
  const photos = findAllReadyPhotos()
  const results: EmbeddedPhoto[] = []
  let lastProgressAt = 0
  for (let i = 0; i < photos.length; i++) {
    if (isCancelled?.()) break
    const embedding = await getOrComputeEmbedding(photos[i].filePath, photos[i].thumbnailKey)
    results.push({ ...photos[i], embedding })
    const done = i + 1
    const now = Date.now()
    if (done === photos.length || now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
      lastProgressAt = now
      onProgress?.(done, photos.length)
    }
  }
  return results
}
