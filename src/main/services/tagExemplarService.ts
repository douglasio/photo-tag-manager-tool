import { getEmbedding, setEmbedding } from '@main/db/embeddingRepository'
import { findPhotoPathsWithTag } from '@main/db/photoRepository'
import type { TagSuggestion } from '@shared/types'

import { embedImage } from './tagSuggestionService'
import { thumbnailFilePath } from './thumbnailService'

// Kept small since a cold cache (right after enabling the feature, or for a
// newly-popular tag) means computing this many *fresh* embeddings — each a
// synchronous ~1-2s trip through the same worker — before results come back.
const MAX_EXAMPLES_PER_TAG = 8
const MIN_EXAMPLES_PER_TAG = 3

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function getOrComputeEmbedding(filePath: string, thumbnailKey: string): Promise<number[]> {
  const cached = getEmbedding(filePath)
  if (cached) return Array.from(cached)

  const imagePath = await thumbnailFilePath(thumbnailKey)
  const embedding = await embedImage(imagePath)
  setEmbedding(filePath, Float32Array.from(embedding))
  return embedding
}

// Average embedding across a tag's own tagged photos — its "visual
// prototype" — or null if it doesn't have enough examples to be reliable yet.
async function getTagPrototype(tag: string): Promise<number[] | null> {
  const examples = findPhotoPathsWithTag(tag, MAX_EXAMPLES_PER_TAG)
  if (examples.length < MIN_EXAMPLES_PER_TAG) return null

  const embeddings = await Promise.all(
    examples.map((example) => getOrComputeEmbedding(example.filePath, example.thumbnailKey))
  )

  const dims = embeddings[0].length
  const sums = new Array<number>(dims).fill(0)
  for (const embedding of embeddings) {
    for (let i = 0; i < dims; i++) sums[i] += embedding[i]
  }
  return sums.map((sum) => sum / embeddings.length)
}

// Ranks candidateTags by how visually similar this photo is to each tag's
// own already-tagged examples — tags without enough examples are omitted
// rather than scored, since a 1-2 photo prototype is too noisy to trust.
export async function suggestTagsByExemplar(
  filePath: string,
  thumbnailKey: string,
  candidateTags: string[]
): Promise<TagSuggestion[]> {
  const targetEmbedding = await getOrComputeEmbedding(filePath, thumbnailKey)

  const results: TagSuggestion[] = []
  for (const tag of candidateTags) {
    const prototype = await getTagPrototype(tag)
    if (!prototype) continue
    results.push({ tag, score: cosineSimilarity(targetEmbedding, prototype) })
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
