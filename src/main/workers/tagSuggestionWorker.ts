import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  env,
  pipeline
} from '@huggingface/transformers'
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

// The text tower for semantic search — loaded lazily on the first embedText
// request rather than during init, since most sessions never use it and it's
// an extra ~60MB download the first time they do.
let textTokenizerPromise: Promise<
  Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>
> | null = null
let textModelPromise: Promise<CLIPTextModelWithProjection> | null = null

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

// Same joint embedding space as loadEmbedder's image_embeds (both are the
// projected head, not the raw hidden state) — see docs/SEARCH_PLAN.md's
// semantic search section for why that distinction matters.
function loadTextTokenizer(): Promise<Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>> {
  if (!textTokenizerPromise) {
    textTokenizerPromise = AutoTokenizer.from_pretrained('Xenova/clip-vit-base-patch32')
  }
  return textTokenizerPromise
}

function loadTextModel(): Promise<CLIPTextModelWithProjection> {
  if (!textModelPromise) {
    textModelPromise = CLIPTextModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32', {
      dtype: 'q8',
      device: 'cpu',
      progress_callback: (info) => {
        if (info.status === 'progress_total')
          post({ type: 'downloadProgress', progress: info.progress })
      }
    })
  }
  return textModelPromise
}

port.on('message', (message: WorkerRequest) => {
  if (message.type === 'embedText') {
    Promise.all([loadTextTokenizer(), loadTextModel()])
      .then(async ([tokenizer, textModel]) => {
        const inputs = tokenizer(message.text, { padding: true, truncation: true })
        const { text_embeds: embeds } = await textModel(inputs)
        post({
          type: 'embedTextResult',
          requestId: message.requestId,
          embedding: Array.from(embeds.data as ArrayLike<number>)
        })
      })
      .catch((err: unknown) => {
        // Reset so a transient failure (e.g. the download dropping) can be
        // retried on the next query rather than wedging permanently.
        textTokenizerPromise = null
        textModelPromise = null
        post({
          type: 'embedTextError',
          requestId: message.requestId,
          message: err instanceof Error ? err.message : String(err)
        })
      })
    return
  }

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
