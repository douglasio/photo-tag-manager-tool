import { app } from 'electron'
import { join } from 'path'
import { Worker } from 'worker_threads'

import type { WorkerRequest, WorkerResponse } from '@main/workers/tagSuggestionProtocol'
import type { TagSuggestion } from '@shared/types'

let worker: Worker | null = null
// Memoized so concurrent callers (e.g. the Settings toggle and Quick Tag
// opening around the same time) share one in-flight init instead of each
// sending their own 'init' message.
let readyPromise: Promise<void> | null = null

let nextRequestId = 0
const pending = new Map<
  number,
  { resolve: (results: TagSuggestion[]) => void; reject: (err: Error) => void }
>()

function getWorker(): Worker {
  if (worker) return worker
  const workerPath = join(__dirname, 'tagSuggestionWorker.js')
  worker = new Worker(workerPath)
  worker.on('message', (message: WorkerResponse) => {
    if (message.type === 'result') {
      pending.get(message.requestId)?.resolve(message.results)
      pending.delete(message.requestId)
    } else if (message.type === 'classifyError') {
      pending.get(message.requestId)?.reject(new Error(message.message))
      pending.delete(message.requestId)
    }
  })
  worker.on('error', (err: Error) => {
    for (const { reject } of pending.values()) reject(err)
    pending.clear()
  })
  return worker
}

function send(message: WorkerRequest): void {
  getWorker().postMessage(message)
}

// Downloads (first time only — cached to disk after) and loads the CLIP
// pipeline into the worker. Idempotent: safe to call before every
// suggestTags request, near-instant once already loaded this session.
export function ensureModelReady(onProgress?: (progress: number) => void): Promise<void> {
  if (readyPromise) return readyPromise

  readyPromise = new Promise<void>((resolve, reject) => {
    const w = getWorker()
    const handleMessage = (message: WorkerResponse): void => {
      if (message.type === 'downloadProgress') {
        onProgress?.(message.progress)
      } else if (message.type === 'ready') {
        w.off('message', handleMessage)
        resolve()
      } else if (message.type === 'initError') {
        w.off('message', handleMessage)
        readyPromise = null
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
    pending.set(requestId, { resolve, reject })
    send({ type: 'classify', requestId, imagePath, candidateLabels })
  })
}

// Frees the worker's memory (model weights, ONNX runtime session) when the
// feature is turned off — the next suggestTags call transparently respawns it.
export async function disposeTagSuggestionWorker(): Promise<void> {
  if (!worker) return
  const w = worker
  worker = null
  readyPromise = null
  for (const { reject } of pending.values()) reject(new Error('AI tag suggestions disabled'))
  pending.clear()
  await w.terminate()
}
