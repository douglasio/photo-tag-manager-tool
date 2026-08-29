import { app } from 'electron'
import { join } from 'path'
import { Worker } from 'worker_threads'

import { rejectAllPending } from '@main/workers/pendingRequests'
import type { WorkerRequest, WorkerResponse } from '@main/workers/tagSuggestionProtocol'
import type { TagSuggestion } from '@shared/types'

let worker: Worker | null = null
// Memoized so concurrent callers (Settings toggle, Quick Tag) share one in-flight init
let readyPromise: Promise<void> | null = null
// Unblocks a caller stuck awaiting ensureModelReady() when the worker is torn down mid-download
let readyReject: ((err: Error) => void) | null = null

let nextRequestId = 0
const pendingClassify = new Map<
  number,
  { resolve: (results: TagSuggestion[]) => void; reject: (err: Error) => void }
>()
const pendingEmbed = new Map<
  number,
  { resolve: (embedding: number[]) => void; reject: (err: Error) => void }
>()
const pendingEmbedText = new Map<
  number,
  { resolve: (embedding: number[]) => void; reject: (err: Error) => void }
>()

// Query text repeats a lot in an interactive search box (backspace-and-retype,
// re-running a recent search) — small enough that 20 entries of 512 floats is
// noise, but skips a worker round trip on every hit.
const TEXT_EMBEDDING_CACHE_SIZE = 20
const textEmbeddingCache = new Map<string, number[]>()

function getCachedTextEmbedding(text: string): number[] | undefined {
  const cached = textEmbeddingCache.get(text)
  if (cached) {
    // Re-insert to bump recency — Map iteration order is insertion order, so
    // the first key is always the least-recently-used one.
    textEmbeddingCache.delete(text)
    textEmbeddingCache.set(text, cached)
  }
  return cached
}

function cacheTextEmbedding(text: string, embedding: number[]): void {
  textEmbeddingCache.set(text, embedding)
  if (textEmbeddingCache.size > TEXT_EMBEDDING_CACHE_SIZE) {
    const oldest = textEmbeddingCache.keys().next().value
    if (oldest !== undefined) textEmbeddingCache.delete(oldest)
  }
}

function getWorker(): Worker {
  if (worker) return worker
  const workerPath = join(__dirname, 'tagSuggestionWorker.js')
  worker = new Worker(workerPath)
  worker.on('message', (message: WorkerResponse) => {
    if (message.type === 'result') {
      pendingClassify.get(message.requestId)?.resolve(message.results)
      pendingClassify.delete(message.requestId)
    } else if (message.type === 'classifyError') {
      pendingClassify.get(message.requestId)?.reject(new Error(message.message))
      pendingClassify.delete(message.requestId)
    } else if (message.type === 'embedResult') {
      pendingEmbed.get(message.requestId)?.resolve(message.embedding)
      pendingEmbed.delete(message.requestId)
    } else if (message.type === 'embedError') {
      pendingEmbed.get(message.requestId)?.reject(new Error(message.message))
      pendingEmbed.delete(message.requestId)
    } else if (message.type === 'embedTextResult') {
      pendingEmbedText.get(message.requestId)?.resolve(message.embedding)
      pendingEmbedText.delete(message.requestId)
    } else if (message.type === 'embedTextError') {
      pendingEmbedText.get(message.requestId)?.reject(new Error(message.message))
      pendingEmbedText.delete(message.requestId)
    }
  })
  worker.on('error', (err: Error) => {
    rejectAllPending(pendingClassify, err)
    rejectAllPending(pendingEmbed, err)
    rejectAllPending(pendingEmbedText, err)
  })
  return worker
}

function send(message: WorkerRequest): void {
  getWorker().postMessage(message)
}

// Downloads (first time only — cached to disk after) and loads both the
// classifier and embedder pipelines. Idempotent: safe to call before every
// request, near-instant once already loaded this session.
export function ensureModelReady(onProgress?: (progress: number) => void): Promise<void> {
  if (readyPromise) return readyPromise

  readyPromise = new Promise<void>((resolve, reject) => {
    readyReject = reject
    const w = getWorker()
    const handleMessage = (message: WorkerResponse): void => {
      if (message.type === 'downloadProgress') {
        onProgress?.(message.progress)
      } else if (message.type === 'ready') {
        w.off('message', handleMessage)
        readyReject = null
        resolve()
      } else if (message.type === 'initError') {
        w.off('message', handleMessage)
        readyPromise = null
        readyReject = null
        reject(new Error(message.message))
      }
    }
    w.on('message', handleMessage)
    send({ type: 'init', cacheDir: join(app.getPath('userData'), 'ai-models') })
  })

  return readyPromise
}

export async function suggestTags(
  imagePath: string,
  candidateLabels: string[]
): Promise<TagSuggestion[]> {
  await ensureModelReady()
  const requestId = nextRequestId++
  return new Promise<TagSuggestion[]>((resolve, reject) => {
    pendingClassify.set(requestId, { resolve, reject })
    send({ type: 'classify', requestId, imagePath, candidateLabels })
  })
}

// Raw CLIP image embedding for one photo — used by tagExemplarService to
// compare a photo against the ones already tagged with a given tag.
export async function embedImage(imagePath: string): Promise<number[]> {
  await ensureModelReady()
  const requestId = nextRequestId++
  return new Promise<number[]>((resolve, reject) => {
    pendingEmbed.set(requestId, { resolve, reject })
    send({ type: 'embed', requestId, imagePath })
  })
}

// Text-side counterpart of embedImage — projects a search phrase into the
// same joint CLIP space as the cached photo embeddings, for semantic search.
// Reuses ensureModelReady() so the worker is up; the text tower itself loads
// lazily inside the worker on the first call, not during ensureModelReady() —
// so onProgress here is for that lazy text-tower download specifically, not
// the classifier/embedder init ensureModelReady() already covers.
export async function embedText(
  text: string,
  onProgress?: (progress: number) => void
): Promise<number[]> {
  const cached = getCachedTextEmbedding(text)
  if (cached) return cached

  await ensureModelReady()
  const requestId = nextRequestId++
  const w = getWorker()

  // Only relevant on the very first call in a session (the worker memoizes
  // the text tower's load promise), but harmless to attach every time —
  // downloadProgress simply never fires again once it's cached to disk.
  const handleProgress = (message: WorkerResponse): void => {
    if (message.type === 'downloadProgress') onProgress?.(message.progress)
  }
  if (onProgress) w.on('message', handleProgress)

  try {
    const embedding = await new Promise<number[]>((resolve, reject) => {
      pendingEmbedText.set(requestId, { resolve, reject })
      send({ type: 'embedText', requestId, text })
    })
    cacheTextEmbedding(text, embedding)
    return embedding
  } finally {
    if (onProgress) w.off('message', handleProgress)
  }
}

// Frees the worker's memory (model weights, ONNX runtime sessions) when the
// feature is turned off — the next request transparently respawns it.
export async function disposeTagSuggestionWorker(): Promise<void> {
  if (!worker) return
  const w = worker
  worker = null
  readyPromise = null
  const disposedError = new Error('AI tag suggestions disabled')
  readyReject?.(disposedError)
  readyReject = null
  rejectAllPending(pendingClassify, disposedError)
  rejectAllPending(pendingEmbed, disposedError)
  rejectAllPending(pendingEmbedText, disposedError)
  textEmbeddingCache.clear()
  await w.terminate()
}
