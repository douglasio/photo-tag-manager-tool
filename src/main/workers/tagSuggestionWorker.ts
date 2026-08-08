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

type Embedder = Awaited<ReturnType<typeof pipeline<'image-feature-extraction'>>>
let embedderPromise: Promise<Embedder> | null = null

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

// A separate model export from the classifier above (CLIP's "compare image
// to text" graph isn't the same file as its "just embed the image" graph),
// so this is its own download/session, not reused from loadClassifier.
function loadEmbedder(cacheDir: string): Promise<Embedder> {
  if (!embedderPromise) {
    env.cacheDir = cacheDir
    embedderPromise = pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
      dtype: 'q8',
      device: 'cpu',
      progress_callback: (info) => {
        if (info.status === 'progress_total')
          post({ type: 'downloadProgress', progress: info.progress })
      }
    })
  }
  return embedderPromise
}

port.on('message', (message: WorkerRequest) => {
  if (message.type === 'init') {
    Promise.all([loadClassifier(message.cacheDir), loadEmbedder(message.cacheDir)])
      .then(() => post({ type: 'ready' }))
      .catch((err: unknown) => {
        classifierPromise = null
        embedderPromise = null
        post({ type: 'initError', message: err instanceof Error ? err.message : String(err) })
      })
    return
  }

  if (message.type === 'embed') {
    if (!embedderPromise) {
      post({ type: 'embedError', requestId: message.requestId, message: 'Model not initialized' })
      return
    }
    embedderPromise
      .then((embedder) => embedder(message.imagePath))
      .then((tensor) => {
        post({
          type: 'embedResult',
          requestId: message.requestId,
          embedding: Array.from(tensor.data as ArrayLike<number>)
        })
      })
      .catch((err: unknown) => {
        post({
          type: 'embedError',
          requestId: message.requestId,
          message: err instanceof Error ? err.message : String(err)
        })
      })
    return
  }

  if (!classifierPromise) {
    post({ type: 'classifyError', requestId: message.requestId, message: 'Model not initialized' })
    return
  }

  classifierPromise
    // Always a single image path, so the result is the flat `{label,
    // score}[]` form. Custom template reads better for in-scene tags.
    .then((classifier) =>
      classifier(message.imagePath, message.candidateLabels, {
        hypothesis_template: 'This is a photo that contains {}'
      })
    )
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
