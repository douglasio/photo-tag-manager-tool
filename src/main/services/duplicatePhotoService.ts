import { getAllEmbeddings } from '@main/db/embeddingRepository'
import type { DuplicateGroup, DuplicateProgress, SimilarPhoto } from '@shared/types'

import { cosineSimilarity, DisjointSet } from './embeddingSimilarity'
import { embedAllReadyPhotos, getOrComputeEmbedding } from './photoEmbedding'

// Near-identical shots (burst mode, minor crop/exposure differences) score
// above this; genuinely different photos essentially never do.
const DUPLICATE_THRESHOLD = 0.97

// Yield to the event loop every this-many pairwise comparisons during
// clustering, so a large library doesn't freeze the main process.
const YIELD_EVERY = 20_000

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

// Embeds every not-yet-cached photo (reporting progress as it goes, since
// this is the slow part on a cold cache), then clusters the full set by
// pairwise cosine similarity. Cached embeddings make every run after the
// first fast — only new/changed photos need embedding again.
export async function findDuplicateGroups(
  onProgress?: (progress: DuplicateProgress) => void
): Promise<DuplicateGroup[]> {
  const embedded = await embedAllReadyPhotos((done, total) => {
    onProgress?.({ phase: 'embedding', done, total })
  })
  const photos = embedded
  const embeddings = embedded.map((photo) => photo.embedding)

  const disjointSet = new DisjointSet(photos.length)
  const totalPairs = (photos.length * (photos.length - 1)) / 2
  let comparisons = 0
  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      if (cosineSimilarity(embeddings[i], embeddings[j]) >= DUPLICATE_THRESHOLD) {
        disjointSet.union(i, j)
      }
      comparisons++
      if (comparisons % YIELD_EVERY === 0) {
        onProgress?.({ phase: 'comparing', done: comparisons, total: totalPairs })
        await yieldToEventLoop()
      }
    }
  }
  onProgress?.({ phase: 'comparing', done: totalPairs, total: totalPairs })

  const groupIndices = new Map<number, number[]>()
  for (let i = 0; i < photos.length; i++) {
    const root = disjointSet.find(i)
    const indices = groupIndices.get(root)
    if (indices) indices.push(i)
    else groupIndices.set(root, [i])
  }

  // Average pairwise similarity within the group — a more meaningful label
  // than an arbitrary group number, and cheap since groups are small.
  return Array.from(groupIndices.values())
    .filter((indices) => indices.length > 1)
    .map((indices) => {
      let total = 0
      let pairs = 0
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          total += cosineSimilarity(embeddings[indices[i]], embeddings[indices[j]])
          pairs++
        }
      }
      return {
        filePaths: indices.map((i) => photos[i].filePath),
        similarity: total / pairs
      }
    })
}

// For one photo's Details Panel — only compares against embeddings already
// cached (no full-library embedding pass), so this stays fast regardless of
// library size; the target photo itself is embedded on demand if missing.
export async function findSimilarPhotos(
  filePath: string,
  thumbnailKey: string,
  limit: number
): Promise<SimilarPhoto[]> {
  const targetEmbedding = await getOrComputeEmbedding(filePath, thumbnailKey)

  const results: SimilarPhoto[] = []
  for (const other of getAllEmbeddings()) {
    if (other.filePath === filePath) continue
    const score = cosineSimilarity(targetEmbedding, other.embedding)
    if (score >= DUPLICATE_THRESHOLD) results.push({ filePath: other.filePath, score })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}
