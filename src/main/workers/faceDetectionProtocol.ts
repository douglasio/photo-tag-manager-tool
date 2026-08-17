import type { FaceBox } from '@shared/types'

// Message shapes exchanged over the faceDetectionWorker's postMessage
// channel — kept in one file so the worker and the service that talks to it
// can't drift out of sync.

export interface DetectedFace {
  box: FaceBox
  embedding: number[]
}

export type WorkerRequest =
  | { type: 'init'; yunetPath: string; sfacePath: string }
  | { type: 'detect'; requestId: number; imagePath: string }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'initError'; message: string }
  | { type: 'detectResult'; requestId: number; faces: DetectedFace[] }
  | { type: 'detectError'; requestId: number; message: string }
