import { getEmbedding, setEmbedding } from '@main/db/embeddingRepository'

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
