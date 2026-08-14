import { DBSCAN } from 'density-clustering'
import { parentPort } from 'node:worker_threads'

import type { FaceClusterResult, WorkerRequest, WorkerResponse } from './faceClusterProtocol'

if (!parentPort) throw new Error('faceClusterWorker must run inside a worker_thread')
const port = parentPort

function post(message: WorkerResponse): void {
  port.postMessage(message)
}

// Face embeddings are L2-normalized (see faceDetectionWorker.ts), so
// Euclidean distance and cosine similarity are directly related
// (euclideanDist² = 2 - 2·cosineSim). 1.128 is OpenCV's own SFace
// same-person L2 threshold (face_recognize.cpp's _threshold_norml2),
// equivalent to its cosine threshold of 0.363 — reused here as DBSCAN's
// neighborhood radius rather than picking an arbitrary number.
const NEIGHBORHOOD_RADIUS = 1.128
// A cluster needs at least 2 similar faces to become a person automatically
// — a single unmatched face stays unclustered (not its own person) until a
// future scan finds a match, so the People panel doesn't fill up with
// one-off strangers/false positives.
const MIN_POINTS_PER_CLUSTER = 2

const cancelledRequests = new Set<number>()

port.on('message', (message: WorkerRequest) => {
  if (message.type === 'cancel') {
    cancelledRequests.add(message.requestId)
    return
  }

  const { requestId, faces } = message
  if (cancelledRequests.has(requestId)) {
    cancelledRequests.delete(requestId)
    post({ type: 'result', requestId, result: { groups: [], noise: [] }, canceled: true })
    return
  }

  try {
    const dataset = faces.map((f) => f.embedding)
    const dbscan = new DBSCAN()
    const clusterIndices = dbscan.run(dataset, NEIGHBORHOOD_RADIUS, MIN_POINTS_PER_CLUSTER)
    const canceled = cancelledRequests.has(requestId)
    cancelledRequests.delete(requestId)

    const result: FaceClusterResult = {
      groups: clusterIndices.map((indices) => indices.map((i) => faces[i].id)),
      noise: dbscan.noise.map((i) => faces[i].id)
    }
    post({ type: 'result', requestId, result, canceled })
  } catch (err) {
    cancelledRequests.delete(requestId)
    post({
      type: 'error',
      requestId,
      message: err instanceof Error ? err.message : String(err)
    })
  }
})
