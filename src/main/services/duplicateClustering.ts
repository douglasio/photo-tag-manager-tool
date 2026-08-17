import type { DuplicateGroup } from '@shared/types'

import {
  cosineSimilarity,
  DisjointSet,
  SIMILARITY_YIELD_EVERY,
  yieldToEventLoop
} from './embeddingSimilarity'

export interface ClusterablePhoto {
  filePath: string
  embedding: number[]
}

// Throttle the onProgress call to avoid excess rerenders during progress
const PROGRESS_INTERVAL_MS = 150

// Clustering math runs inside duplicateClusterWorker (off the main process) while staying
// directly unit-testable without spinning up a real worker_thread.
export async function clusterByEmbeddingSimilarity(
  photos: ClusterablePhoto[],
  threshold: number,
  onProgress?: (comparisons: number, totalPairs: number) => void,
  isCancelled?: () => boolean
): Promise<{ groups: DuplicateGroup[]; canceled: boolean }> {
  const disjointSet = new DisjointSet(photos.length)
  const totalPairs = (photos.length * (photos.length - 1)) / 2
  let comparisons = 0
  let canceled = false
  let lastProgressAt = 0

  outer: for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      if (cosineSimilarity(photos[i].embedding, photos[j].embedding) >= threshold) {
        disjointSet.union(i, j)
      }
      comparisons++
      if (comparisons % SIMILARITY_YIELD_EVERY === 0) {
        const now = Date.now()
        if (now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
          lastProgressAt = now
          onProgress?.(comparisons, totalPairs)
        }
        if (isCancelled?.()) {
          canceled = true
          break outer
        }
        await yieldToEventLoop()
      }
    }
  }
  onProgress?.(canceled ? comparisons : totalPairs, totalPairs)
  if (canceled) return { groups: [], canceled: true }

  const groupIndices = new Map<number, number[]>()
  for (let i = 0; i < photos.length; i++) {
    const root = disjointSet.find(i)
    const indices = groupIndices.get(root)
    if (indices) indices.push(i)
    else groupIndices.set(root, [i])
  }

  // Average pairwise similarity within the group — a more meaningful label
  // than an arbitrary group number, and cheap since groups are small.
  const groups = Array.from(groupIndices.values())
    .filter((indices) => indices.length > 1)
    .map((indices) => {
      let total = 0
      let pairs = 0
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          total += cosineSimilarity(photos[indices[i]].embedding, photos[indices[j]].embedding)
          pairs++
        }
      }
      return {
        filePaths: indices.map((i) => photos[i].filePath),
        similarity: total / pairs
      }
    })

  return { groups, canceled: false }
}
