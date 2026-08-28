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
// lazily inside the worker on the first call, not during ensureModelReady().
export async function embedText(text: string): Promise<number[]> {
  await ensureModelReady()
  const requestId = nextRequestId++
  return new Promise<number[]>((resolve, reject) => {
    pendingEmbedText.set(requestId, { resolve, reject })
    send({ type: 'embedText', requestId, text })
  })
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
  await w.terminate()
}
