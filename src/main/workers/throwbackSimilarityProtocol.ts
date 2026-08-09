import type { ThrowbackEntry } from '@shared/types'

// Message shapes exchanged over the throwbackSimilarityWorker's postMessage
// channel — kept in one file so the worker and the service that talks to it
// can't drift out of sync.

export interface SimilarityInputPhoto {
  filePath: string
  embedding: number[]
  year: number
}

export interface WorkerRequest {
  type: 'compute'
  requestId: number
  photos: SimilarityInputPhoto[]
  threshold: number
}

export type WorkerResponse =
  | { type: 'result'; requestId: number; entries: ThrowbackEntry[] | null }
  | { type: 'error'; requestId: number; message: string }
