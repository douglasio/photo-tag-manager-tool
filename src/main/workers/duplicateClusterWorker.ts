import { parentPort } from 'node:worker_threads'

import { clusterByEmbeddingSimilarity } from '@main/services/duplicateClustering'

import type { WorkerRequest, WorkerResponse } from './duplicateClusterProtocol'

if (!parentPort) throw new Error('duplicateClusterWorker must run inside a worker_thread')
const port = parentPort

function post(message: WorkerResponse): void {
  port.postMessage(message)
}

// Cancellation is coarser than instant (checked at the same cadence as
// progress, every 20,000 comparisons) — the request can't be looked up by
// requestId until it's actually running, so a plain Set is enough here.
const cancelledRequests = new Set<number>()

port.on('message', (message: WorkerRequest) => {
  if (message.type === 'cancel') {
    cancelledRequests.add(message.requestId)
    return
  }

  const { requestId, photos, threshold } = message
  clusterByEmbeddingSimilarity(
    photos,
    threshold,
    (comparisons, totalPairs) => post({ type: 'progress', requestId, comparisons, totalPairs }),
    () => cancelledRequests.has(requestId)
  )
    .then(({ groups, canceled }) => {
      cancelledRequests.delete(requestId)
      post({ type: 'result', requestId, groups, canceled })
    })
    .catch((err: unknown) => {
      cancelledRequests.delete(requestId)
      post({
        type: 'error',
        requestId,
        message: err instanceof Error ? err.message : String(err)
      })
    })
})
