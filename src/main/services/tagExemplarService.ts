import { findPhotoPathsWithTag } from '@main/db/photoRepository'
import type { TagSuggestion } from '@shared/types'

import { cosineSimilarity } from './embeddingSimilarity'
import { getOrComputeEmbedding } from './photoEmbedding'

const MAX_EXAMPLES_PER_TAG = 8
const MIN_EXAMPLES_PER_TAG = 3

// Average embedding across a tag's photos
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

// Ranks candidateTags by how visually similar this photo is to each tag's already-tagged examples
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
