import type { TagSuggestion } from '@shared/types'

// Message shapes exchanged over the tagSuggestionWorker's postMessage
// channel — kept in one file so the worker and the service that talks to it
// can't drift out of sync.

export type WorkerRequest =
  | { type: 'init'; cacheDir: string }
  | { type: 'classify'; requestId: number; imagePath: string; candidateLabels: string[] }
  | { type: 'embed'; requestId: number; imagePath: string }
  | { type: 'embedText'; requestId: number; text: string }

export type WorkerResponse =
  | { type: 'downloadProgress'; progress: number }
  | { type: 'ready' }
  | { type: 'initError'; message: string }
  | { type: 'result'; requestId: number; results: TagSuggestion[] }
  | { type: 'classifyError'; requestId: number; message: string }
  | { type: 'embedResult'; requestId: number; embedding: number[] }
  | { type: 'embedError'; requestId: number; message: string }
  | { type: 'embedTextResult'; requestId: number; embedding: number[] }
  | { type: 'embedTextError'; requestId: number; message: string }
