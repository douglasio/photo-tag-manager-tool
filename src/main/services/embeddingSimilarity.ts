// Shared by duplicateClustering and throwbackSimilarity — yield to the event loop every this-many pairwise comparisons
export const SIMILARITY_YIELD_EVERY = 20_000

export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

// Shared by tagExemplarService (tag prototypes) and duplicatePhotoService
// (near-duplicate detection) — both compare CLIP image embeddings.
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
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

// Union-find — shared by duplicatePhotoService and throwbackService, both of
// which merge items whose embeddings are similarity-linked
export class DisjointSet {
  private parent: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i)
  }

  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]]
      i = this.parent[i]
    }
    return i
  }

  union(a: number, b: number): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent[rootA] = rootB
  }
}
