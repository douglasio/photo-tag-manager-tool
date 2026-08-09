import type { ThrowbackEntry } from '@shared/types'

import {
  cosineSimilarity,
  DisjointSet,
  SIMILARITY_YIELD_EVERY,
  yieldToEventLoop
} from './embeddingSimilarity'

export interface ThrowbackCandidate {
  filePath: string
  embedding: number[]
  year: number
}

// Pure clustering + selection math, pulled out of throwbackService so it can
// run inside throwbackSimilarityWorker (off the main process — this used to
// run inline and could visibly block the app once enough embeddings piled
// up) while staying directly unit-testable. Picks the cross-year cluster
// spanning the most distinct years, then the best-fitting photo per year.
export async function computeThrowbackSimilarity(
  photos: ThrowbackCandidate[],
  threshold: number
): Promise<ThrowbackEntry[] | null> {
  if (photos.length < 2) return null

  const disjointSet = new DisjointSet(photos.length)
  let comparisons = 0
  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      if (
        photos[i].year !== photos[j].year &&
        cosineSimilarity(photos[i].embedding, photos[j].embedding) >= threshold
      ) {
        disjointSet.union(i, j)
      }
      comparisons++
      if (comparisons % SIMILARITY_YIELD_EVERY === 0) await yieldToEventLoop()
    }
  }

  const groupIndices = new Map<number, number[]>()
  for (let i = 0; i < photos.length; i++) {
    const root = disjointSet.find(i)
    const indices = groupIndices.get(root)
    if (indices) indices.push(i)
    else groupIndices.set(root, [i])
  }

  // The cluster spanning the most distinct years is the most
  // "throwback"-worthy set to show.
  let best: { indices: number[]; years: Set<number> } | null = null
  for (const indices of groupIndices.values()) {
    const years = new Set(indices.map((i) => photos[i].year))
    if (years.size < 2) continue
    if (!best || years.size > best.years.size) best = { indices, years }
  }
  if (!best) return null

  // At most one photo per year within the winning cluster — pick whichever
  // has the highest average similarity to the rest of the group.
  const indicesByYear = new Map<number, number[]>()
  for (const i of best.indices) {
    const year = photos[i].year
    const list = indicesByYear.get(year)
    if (list) list.push(i)
    else indicesByYear.set(year, [i])
  }

  const entries: ThrowbackEntry[] = []
  for (const [year, indices] of indicesByYear) {
    let bestIndex = indices[0]
    let bestScore = -Infinity
    for (const i of indices) {
      let total = 0
      for (const j of best.indices) {
        if (j !== i) total += cosineSimilarity(photos[i].embedding, photos[j].embedding)
      }
      if (total > bestScore) {
        bestScore = total
        bestIndex = i
      }
    }
    entries.push({ year, filePath: photos[bestIndex].filePath })
  }

  entries.sort((a, b) => a.year - b.year)
  return entries
}
