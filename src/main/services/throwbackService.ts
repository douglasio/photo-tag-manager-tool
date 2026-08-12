import { join } from 'path'
import { Worker } from 'worker_threads'

import { getAllEmbeddings } from '@main/db/embeddingRepository'
import { findAllReadyPhotosWithDate } from '@main/db/photoRepository'
import { rejectAllPending } from '@main/workers/pendingRequests'
import type {
  SimilarityInputPhoto,
  WorkerRequest,
  WorkerResponse
} from '@main/workers/throwbackSimilarityProtocol'
import type { ThrowbackEntry, ThrowbackYearSample } from '@shared/types'

// "Kinda similar, not a match" — much looser than duplicate detection's
// 0.97, since these are meant to be the same general subject/scene across
// different years, not near-identical shots.
const THROWBACK_SIMILARITY_THRESHOLD = 0.7

const MIN_YEAR_SAMPLE_PHOTOS = 4
const YEAR_SAMPLE_SIZE = 4

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

interface YearPhoto {
  filePath: string
  thumbnailKey: string
  year: number
}

function readyPhotosByYear(): Map<number, YearPhoto[]> {
  const byYear = new Map<number, YearPhoto[]>()
  for (const photo of findAllReadyPhotosWithDate()) {
    const year = new Date(photo.dateTaken).getFullYear()
    const entry: YearPhoto = { filePath: photo.filePath, thumbnailKey: photo.thumbnailKey, year }
    const list = byYear.get(year)
    if (list) list.push(entry)
    else byYear.set(year, [entry])
  }
  return byYear
}

let worker: Worker | null = null
let nextRequestId = 0
const pendingCompute = new Map<
  number,
  { resolve: (entries: ThrowbackEntry[] | null) => void; reject: (err: Error) => void }
>()

function getWorker(): Worker {
  if (worker) return worker
  const workerPath = join(__dirname, 'throwbackSimilarityWorker.js')
  worker = new Worker(workerPath)
  worker.on('message', (message: WorkerResponse) => {
    const pending = pendingCompute.get(message.requestId)
    if (!pending) return
    pendingCompute.delete(message.requestId)
    if (message.type === 'result') pending.resolve(message.entries)
    else pending.reject(new Error(message.message))
  })
  worker.on('error', (err: Error) => {
    rejectAllPending(pendingCompute, err)
  })
  return worker
}

function send(message: WorkerRequest): void {
  getWorker().postMessage(message)
}

// Cache-only — never triggers embedding compute, so this stays fast and
// automatic on every Dashboard load (the opt-in "Time Warp" scan is what
// populates the cache; see embedAllReadyPhotos). The O(n²) cross-year
// comparison runs in a worker (mirrors duplicate detection) since a large
// cached-embeddings backlog used to visibly block the main process here.
// Returns null once fewer than 2 distinct years show up in the
// best-matching cross-year cluster.
export async function findThrowbackSimilarity(): Promise<ThrowbackEntry[] | null> {
  const yearByPath = new Map<string, number>()
  for (const [year, photos] of readyPhotosByYear()) {
    for (const photo of photos) yearByPath.set(photo.filePath, year)
  }

  const cached = getAllEmbeddings().filter((embedded) => yearByPath.has(embedded.filePath))
  if (cached.length < 2) return null

  const photos: SimilarityInputPhoto[] = cached.map((embedded) => ({
    filePath: embedded.filePath,
    embedding: Array.from(embedded.embedding),
    year: yearByPath.get(embedded.filePath)!
  }))

  const requestId = nextRequestId++
  const resultPromise = new Promise<ThrowbackEntry[] | null>((resolve, reject) => {
    pendingCompute.set(requestId, { resolve, reject })
  })
  send({ type: 'compute', requestId, photos, threshold: THROWBACK_SIMILARITY_THRESHOLD })
  return resultPromise
}

// Frees the worker when AI features are disabled — the next dashboard load
// transparently respawns it.
export async function disposeThrowbackSimilarityWorker(): Promise<void> {
  if (!worker) return
  const w = worker
  worker = null
  const disposedError = new Error('Throwback similarity worker disposed')
  rejectAllPending(pendingCompute, disposedError)
  await w.terminate()
}

// Fallback for when there's no similarity match (yet) — a random sample from
// a single past year, no embeddings involved at all.
export function findThrowbackYearSample(): ThrowbackYearSample | null {
  const currentYear = new Date().getFullYear()
  const candidateYears = Array.from(readyPhotosByYear().entries()).filter(
    ([year, photos]) => year < currentYear && photos.length >= MIN_YEAR_SAMPLE_PHOTOS
  )
  if (candidateYears.length === 0) return null

  const [year, photos] = candidateYears[Math.floor(Math.random() * candidateYears.length)]
  const sample = shuffle(photos).slice(0, YEAR_SAMPLE_SIZE)
  return { year, filePaths: sample.map((photo) => photo.filePath) }
}

// Random one-photo-per-year across every year present — no embeddings or
// similarity involved. Used by the widget's "Preview Time Warp" button, both
// as a teaser of what the real feature looks like and as a way to exercise
// the Timeline UI without needing a library with genuinely similar
// cross-year photos on hand.
export function findThrowbackPreview(): ThrowbackEntry[] | null {
  const byYear = readyPhotosByYear()
  if (byYear.size < 2) return null

  const entries: ThrowbackEntry[] = []
  for (const [year, photos] of byYear) {
    entries.push({ year, filePath: photos[Math.floor(Math.random() * photos.length)].filePath })
  }
  entries.sort((a, b) => a.year - b.year)
  return entries
}
