import { parentPort } from 'node:worker_threads'

import { computeThrowbackSimilarity } from '@main/services/throwbackSimilarity'

import type { WorkerRequest, WorkerResponse } from './throwbackSimilarityProtocol'

if (!parentPort) throw new Error('throwbackSimilarityWorker must run inside a worker_thread')
const port = parentPort

function post(message: WorkerResponse): void {
  port.postMessage(message)
}

port.on('message', ({ requestId, photos, threshold }: WorkerRequest) => {
  computeThrowbackSimilarity(photos, threshold)
    .then((entries) => post({ type: 'result', requestId, entries }))
    .catch((err: unknown) => {
      post({ type: 'error', requestId, message: err instanceof Error ? err.message : String(err) })
    })
})
