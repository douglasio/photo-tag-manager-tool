import { join } from 'path'
import { Worker } from 'worker_threads'

import { getAllEmbeddings } from '@main/db/embeddingRepository'
import type {
  ClusterInputPhoto,
  WorkerRequest,
  WorkerResponse
} from '@main/workers/duplicateClusterProtocol'
import { rejectAllPending } from '@main/workers/pendingRequests'
import type { DuplicateGroup, SimilarPhoto } from '@shared/types'

import { cosineSimilarity } from './embeddingSimilarity'
import type { EmbeddedPhoto } from './photoEmbedding'
import { getOrComputeEmbedding } from './photoEmbedding'

// Near-identical shots (burst mode, minor crop/exposure differences) score
// above this; genuinely different photos essentially never do.
const DUPLICATE_THRESHOLD = 0.97

let worker: Worker | null = null
let nextRequestId = 0
const pendingCluster = new Map<
  number,
  {
    resolve: (result: { groups: DuplicateGroup[]; canceled: boolean }) => void
    reject: (err: Error) => void
    onProgress?: (comparisons: number, totalPairs: number) => void
  }
>()

function getWorker(): Worker {
  if (worker) return worker
  const workerPath = join(__dirname, 'duplicateClusterWorker.js')
  worker = new Worker(workerPath)
  worker.on('message', (message: WorkerResponse) => {
    const pending = pendingCluster.get(message.requestId)
    if (!pending) return
    if (message.type === 'progress') {
      pending.onProgress?.(message.comparisons, message.totalPairs)
    } else if (message.type === 'result') {
      pending.resolve({ groups: message.groups, canceled: message.canceled })
      pendingCluster.delete(message.requestId)
    } else if (message.type === 'error') {
      pending.reject(new Error(message.message))
      pendingCluster.delete(message.requestId)
    }
  })
  worker.on('error', (err: Error) => {
    rejectAllPending(pendingCluster, err)
  })
  return worker
}

function send(message: WorkerRequest): void {
  getWorker().postMessage(message)
}

// Clusters already-embedded photos by pairwise cosine similarity, off the
// main process — the O(n²) comparison used to run inline here and could
// visibly block the app on a large library. isCancelled is polled (the
// worker can't see the caller's flag directly) and forwarded as a 'cancel'
// message the first time it flips true.
export async function clusterDuplicates(
  photos: EmbeddedPhoto[],
  onProgress?: (comparisons: number, totalPairs: number) => void,
  isCancelled?: () => boolean
): Promise<{ groups: DuplicateGroup[]; canceled: boolean }> {
  const requestId = nextRequestId++
  const clusterInput: ClusterInputPhoto[] = photos.map(({ filePath, embedding }) => ({
    filePath,
    embedding
  }))

  const resultPromise = new Promise<{ groups: DuplicateGroup[]; canceled: boolean }>(
    (resolve, reject) => {
      pendingCluster.set(requestId, { resolve, reject, onProgress })
    }
  )
  send({ type: 'cluster', requestId, photos: clusterInput, threshold: DUPLICATE_THRESHOLD })

  let cancelTimer: ReturnType<typeof setInterval> | null = null
  if (isCancelled) {
    cancelTimer = setInterval(() => {
      if (isCancelled()) send({ type: 'cancel', requestId })
    }, 200)
  }

  try {
    return await resultPromise
  } finally {
    if (cancelTimer) clearInterval(cancelTimer)
  }
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

// Frees the worker when AI features are disabled or the app quits — the
// next cluster request transparently respawns it.
export async function disposeDuplicateClusterWorker(): Promise<void> {
  if (!worker) return
  const w = worker
  worker = null
  const disposedError = new Error('Duplicate detection worker disposed')
  rejectAllPending(pendingCluster, disposedError)
  await w.terminate()
}
