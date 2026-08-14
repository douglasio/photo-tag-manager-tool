import { join } from 'path'
import { Worker } from 'worker_threads'

import {
  applyAutoClusterAssignment,
  createPerson,
  getPinnedAssignedFaces,
  getUnpinnedFaces
} from '@main/db/faceRepository'
import type {
  ClusterableFace,
  FaceClusterResult,
  WorkerRequest,
  WorkerResponse
} from '@main/workers/faceClusterProtocol'
import { rejectAllPending } from '@main/workers/pendingRequests'

import { cosineSimilarity } from './embeddingSimilarity'

// Same OpenCV SFace same-person cosine threshold used as faceClusterWorker's
// DBSCAN radius (see that file's comment) — reused here to decide whether a
// freshly-clustered group of faces matches an existing person's centroid
// closely enough to join them, rather than becoming a new person.
const CENTROID_MATCH_THRESHOLD = 0.363

let worker: Worker | null = null
let nextRequestId = 0
const pendingCluster = new Map<
  number,
  {
    resolve: (result: { result: FaceClusterResult; canceled: boolean }) => void
    reject: (err: Error) => void
  }
>()

function getWorker(): Worker {
  if (worker) return worker
  const workerPath = join(__dirname, 'faceClusterWorker.js')
  worker = new Worker(workerPath)
  worker.on('message', (message: WorkerResponse) => {
    const pending = pendingCluster.get(message.requestId)
    if (!pending) return
    if (message.type === 'result') {
      pending.resolve({ result: message.result, canceled: message.canceled })
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

function averageEmbedding(embeddings: ArrayLike<number>[]): number[] {
  const dims = embeddings[0].length
  const sum = new Array<number>(dims).fill(0)
  for (const embedding of embeddings) {
    for (let i = 0; i < dims; i++) sum[i] += embedding[i]
  }
  return sum.map((v) => v / embeddings.length)
}

/** Re-clusters every unpinned face (pinned faces — manual assign/split/
 * unassign — are never touched, see faceRepository.getUnpinnedFaces) and
 * writes the result back: existing DBSCAN groups that centroid-match a
 * pinned person join that person, groups that don't match anyone become a
 * new person, and noise faces are cleared back to unassigned. */
export async function runFaceClustering(
  isCancelled?: () => boolean
): Promise<{ peopleCreated: number; facesAssigned: number; canceled: boolean }> {
  const unpinned = getUnpinnedFaces()
  if (unpinned.length === 0) return { peopleCreated: 0, facesAssigned: 0, canceled: false }

  const pinned = getPinnedAssignedFaces()
  const requestId = nextRequestId++
  const faces: ClusterableFace[] = unpinned.map((f) => ({
    id: f.id,
    embedding: Array.from(f.embedding)
  }))

  const resultPromise = new Promise<{ result: FaceClusterResult; canceled: boolean }>(
    (resolve, reject) => {
      pendingCluster.set(requestId, { resolve, reject })
    }
  )
  send({ type: 'cluster', requestId, faces })

  let cancelTimer: ReturnType<typeof setInterval> | null = null
  if (isCancelled) {
    cancelTimer = setInterval(() => {
      if (isCancelled()) send({ type: 'cancel', requestId })
    }, 200)
  }

  let outcome: { result: FaceClusterResult; canceled: boolean }
  try {
    outcome = await resultPromise
  } finally {
    if (cancelTimer) clearInterval(cancelTimer)
  }
  if (outcome.canceled) return { peopleCreated: 0, facesAssigned: 0, canceled: true }

  const embeddingById = new Map(unpinned.map((f) => [f.id, f.embedding]))

  const personEmbeddings = new Map<string, ArrayLike<number>[]>()
  for (const face of pinned) {
    const list = personEmbeddings.get(face.personId) ?? []
    list.push(face.embedding)
    personEmbeddings.set(face.personId, list)
  }
  const personCentroids = new Map<string, number[]>()
  for (const [personId, embeddings] of personEmbeddings) {
    personCentroids.set(personId, averageEmbedding(embeddings))
  }

  let peopleCreated = 0
  let facesAssigned = 0

  for (const group of outcome.result.groups) {
    const groupEmbeddings = group
      .map((id) => embeddingById.get(id))
      .filter((e): e is Float32Array => e !== undefined)
    const centroid = averageEmbedding(groupEmbeddings)

    let matchedPersonId: string | null = null
    let bestSimilarity = CENTROID_MATCH_THRESHOLD
    for (const [personId, personCentroid] of personCentroids) {
      const similarity = cosineSimilarity(centroid, personCentroid)
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        matchedPersonId = personId
      }
    }

    const targetPersonId = matchedPersonId ?? createPerson(group[0]).id
    if (!matchedPersonId) peopleCreated++
    for (const faceId of group) {
      applyAutoClusterAssignment(faceId, targetPersonId)
      facesAssigned++
    }
  }

  for (const faceId of outcome.result.noise) {
    applyAutoClusterAssignment(faceId, null)
  }

  return { peopleCreated, facesAssigned, canceled: false }
}

export async function disposeFaceClusterWorker(): Promise<void> {
  if (!worker) return
  const w = worker
  worker = null
  const disposedError = new Error('Face clustering worker disposed')
  rejectAllPending(pendingCluster, disposedError)
  await w.terminate()
}
