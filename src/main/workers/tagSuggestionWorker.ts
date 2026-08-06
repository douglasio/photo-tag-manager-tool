import { env, pipeline } from '@huggingface/transformers'
import { parentPort } from 'node:worker_threads'

import type { WorkerRequest, WorkerResponse } from './tagSuggestionProtocol'

if (!parentPort) throw new Error('tagSuggestionWorker must run inside a worker_thread')
const port = parentPort

function post(message: WorkerResponse): void {
  port.postMessage(message)
}

type Classifier = Awaited<ReturnType<typeof pipeline<'zero-shot-image-classification'>>>
let classifierPromise: Promise<Classifier> | null = null

// Memoized — the model only needs downloading/loading once per worker
// lifetime; every request after the first reuses this same promise.
function loadClassifier(cacheDir: string): Promise<Classifier> {
  if (!classifierPromise) {
    env.cacheDir = cacheDir
    classifierPromise = pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
      dtype: 'q8',
      device: 'cpu',
      progress_callback: (info) => {
        if (info.status === 'progress_total')
          post({ type: 'downloadProgress', progress: info.progress })
      }
    })
  }
  return classifierPromise
}

port.on('message', (message: WorkerRequest) => {
  if (message.type === 'init') {
    loadClassifier(message.cacheDir)
      .then(() => post({ type: 'ready' }))
      .catch((err: unknown) => {
        classifierPromise = null
        post({ type: 'initError', message: err instanceof Error ? err.message : String(err) })
      })
    return
  }

  if (!classifierPromise) {
    post({ type: 'classifyError', requestId: message.requestId, message: 'Model not initialized' })
    return
  }

  classifierPromise
    // Always a single image path (never an array), so the result is always
    // the flat `{label, score}[]` form, not the nested per-image variant.
    .then((classifier) => classifier(message.imagePath, message.candidateLabels))
    .then((results) => {
      post({
        type: 'result',
        requestId: message.requestId,
        results: results.map((r) => ({ tag: r.label, score: r.score }))
      })
    })
    .catch((err: unknown) => {
      post({
        type: 'classifyError',
        requestId: message.requestId,
        message: err instanceof Error ? err.message : String(err)
      })
    })
})
