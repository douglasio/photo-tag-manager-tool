// Message shapes exchanged over the faceClusterWorker's postMessage
// channel — kept in one file so the worker and the service that talks to it
// can't drift out of sync.

export interface ClusterableFace {
  id: string
  embedding: number[]
}

export interface FaceClusterResult {
  // Each inner array is a group of face ids DBSCAN considers the same
  // person (2+ members). Faces DBSCAN couldn't confidently group stay out
  // of every group entirely (see `noise`).
  groups: string[][]
  // Face ids DBSCAN couldn't confidently place in any group.
  noise: string[]
}

export type WorkerRequest =
  | { type: 'cluster'; requestId: number; faces: ClusterableFace[] }
  | { type: 'cancel'; requestId: number }

export type WorkerResponse =
  | { type: 'result'; requestId: number; result: FaceClusterResult; canceled: boolean }
  | { type: 'error'; requestId: number; message: string }
