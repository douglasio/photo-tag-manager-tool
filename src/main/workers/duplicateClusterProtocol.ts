import type { DuplicateGroup } from '@shared/types'

// Message shapes exchanged over the duplicateClusterWorker's postMessage
// channel — kept in one file so the worker and the service that talks to it
// can't drift out of sync.

export interface ClusterInputPhoto {
  filePath: string
  embedding: number[]
}

export type WorkerRequest =
  | { type: 'cluster'; requestId: number; photos: ClusterInputPhoto[]; threshold: number }
  | { type: 'cancel'; requestId: number }

export type WorkerResponse =
  | { type: 'progress'; requestId: number; comparisons: number; totalPairs: number }
  | { type: 'result'; requestId: number; groups: DuplicateGroup[]; canceled: boolean }
  | { type: 'error'; requestId: number; message: string }
