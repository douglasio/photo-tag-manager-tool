import { access } from 'fs/promises'

import { getEmbedding, setEmbedding } from '@main/db/embeddingRepository'
import { findAllReadyPhotos, photoExists } from '@main/db/photoRepository'

import { embedImage } from './tagSuggestionService'
import { generateThumbnail, thumbnailFilePath } from './thumbnailService'

// Reads the cached embedding if there is one, otherwise computes and caches it
export async function getOrComputeEmbedding(
  filePath: string,
  thumbnailKey: string
): Promise<number[]> {
  const cached = getEmbedding(filePath)
  if (cached) return Array.from(cached)

  const imagePath = await thumbnailFilePath(thumbnailKey)
  // Handles if a thumbnail file goes missing without its db row knowing
  const exists = await access(imagePath).then(
    () => true,
    () => false
  )
  if (!exists) {
    await generateThumbnail(filePath, thumbnailKey)
  }

  const embedding = await embedImage(imagePath)
  setEmbedding(filePath, Float32Array.from(embedding))
  return embedding
}

export interface EmbeddedPhoto {
  filePath: string
  thumbnailKey: string
  embedding: number[]
}

// Throttles the onProgress call to avoid slowdowns
const PROGRESS_INTERVAL_MS = 150

// Embeds every not-yet-cached ready photo, reporting progress as it goes
export async function embedAllReadyPhotos(
  onProgress?: (done: number, total: number) => void,
  isCancelled?: () => boolean
): Promise<EmbeddedPhoto[]> {
  const photos = findAllReadyPhotos()
  const results: EmbeddedPhoto[] = []
  let lastProgressAt = 0
  for (let i = 0; i < photos.length; i++) {
    if (isCancelled?.()) break
    // The photo list is a snapshot from before this loop started — a folder
    // removed mid-scan deletes its rows, but this array still holds them.
    // Skipping the embed here (rather than only checking at the top of the
    // scan) stops removal from resurrecting a fresh, orphaned embedding for
    // a path no longer in the photos table. Still counted below in `done`
    // (loop position, not work done) so the progress bar keeps reaching 100%.
    if (photoExists(photos[i].filePath)) {
      // handle corrupt photos without breaking scan
      try {
        const embedding = await getOrComputeEmbedding(photos[i].filePath, photos[i].thumbnailKey)
        results.push({ ...photos[i], embedding })
      } catch (err) {
        console.error(`failed to embed ${photos[i].filePath}, skipping`, err)
      }
    }
    const done = i + 1
    const now = Date.now()
    if (done === photos.length || now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
      lastProgressAt = now
      onProgress?.(done, photos.length)
    }
  }
  return results
}
