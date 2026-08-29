import { join } from 'path'
import { Worker } from 'worker_threads'

import type {
  DetectedFace,
  WorkerRequest,
  WorkerResponse
} from '@main/workers/faceDetectionProtocol'
import { rejectAllPending } from '@main/workers/pendingRequests'

import { getModelPath } from './modelPaths'

let worker: Worker | null = null
// Memoized so concurrent callers share one in-flight init
let readyPromise: Promise<void> | null = null
let readyReject: ((err: Error) => void) | null = null

let nextRequestId = 0
const pendingDetect = new Map<
  number,
  { resolve: (faces: DetectedFace[]) => void; reject: (err: Error) => void }
>()

function getWorker(): Worker {
  if (worker) return worker
  const workerPath = join(__dirname, 'faceDetectionWorker.js')
  worker = new Worker(workerPath)
  worker.on('message', (message: WorkerResponse) => {
    if (message.type === 'detectResult') {
      pendingDetect.get(message.requestId)?.resolve(message.faces)
      pendingDetect.delete(message.requestId)
    } else if (message.type === 'detectError') {
      pendingDetect.get(message.requestId)?.reject(new Error(message.message))
      pendingDetect.delete(message.requestId)
    }
  })
  worker.on('error', (err: Error) => {
    // A worker that dies during init (bad model path, native load failure)
    // would otherwise leave ensureFaceModelReady's promise pending forever,
    // hanging the scan with a spinner that never resolves. Clearing
    // readyPromise also lets a later attempt rebuild the worker.
    readyReject?.(err)
    readyReject = null
    readyPromise = null
    worker = null
    rejectAllPending(pendingDetect, err)
  })
  return worker
}

function send(message: WorkerRequest): void {
  getWorker().postMessage(message)
}

// Loads YuNet/SFace into the worker
export function ensureFaceModelReady(): Promise<void> {
  if (readyPromise) return readyPromise

  readyPromise = new Promise<void>((resolve, reject) => {
    readyReject = reject
    const w = getWorker()
    const handleMessage = (message: WorkerResponse): void => {
      if (message.type === 'ready') {
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
    send({
      type: 'init',
      yunetPath: getModelPath('yunet.onnx'),
      sfacePath: getModelPath('sface.onnx')
    })
  })

  return readyPromise
}

export async function detectFacesInImage(imagePath: string): Promise<DetectedFace[]> {
  await ensureFaceModelReady()
  const requestId = nextRequestId++
  return new Promise<DetectedFace[]>((resolve, reject) => {
    pendingDetect.set(requestId, { resolve, reject })
    send({ type: 'detect', requestId, imagePath })
  })
}

// Frees the worker's memory when face detection is disabled
export async function disposeFaceDetectionWorker(): Promise<void> {
  if (!worker) return
  const w = worker
  worker = null
  readyPromise = null
  const disposedError = new Error('Face detection disabled')
  readyReject?.(disposedError)
  readyReject = null
  rejectAllPending(pendingDetect, disposedError)
  await w.terminate()
}
