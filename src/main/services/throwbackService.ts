import { getAllEmbeddings } from '@main/db/embeddingRepository'
import { findAllReadyPhotosWithDate } from '@main/db/photoRepository'
import type { ThrowbackEntry, ThrowbackYearSample } from '@shared/types'

import { cosineSimilarity, DisjointSet } from './embeddingSimilarity'

// "Kinda similar, not a match" — much looser than duplicate detection's
// 0.97, since these are meant to be the same general subject/scene across
// different years, not near-identical shots.
const THROWBACK_SIMILARITY_THRESHOLD = 0.7

const MIN_YEAR_SAMPLE_PHOTOS = 4
const YEAR_SAMPLE_SIZE = 4

const YIELD_EVERY = 20_000
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

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

// Cache-only — never triggers embedding compute, so this stays fast and
// automatic on every Dashboard load (the opt-in "Time Warp" scan is what
// populates the cache; see embedAllReadyPhotos). Returns null once fewer
// than 2 distinct years show up in the best-matching cross-year cluster.
export async function findThrowbackSimilarity(): Promise<ThrowbackEntry[] | null> {
  const yearByPath = new Map<string, number>()
  for (const [year, photos] of readyPhotosByYear()) {
    for (const photo of photos) yearByPath.set(photo.filePath, year)
  }

  const cached = getAllEmbeddings().filter((embedded) => yearByPath.has(embedded.filePath))
  if (cached.length < 2) return null

  const disjointSet = new DisjointSet(cached.length)
  let comparisons = 0
  for (let i = 0; i < cached.length; i++) {
    for (let j = i + 1; j < cached.length; j++) {
      const yearI = yearByPath.get(cached[i].filePath)!
      const yearJ = yearByPath.get(cached[j].filePath)!
      if (
        yearI !== yearJ &&
        cosineSimilarity(cached[i].embedding, cached[j].embedding) >= THROWBACK_SIMILARITY_THRESHOLD
      ) {
        disjointSet.union(i, j)
      }
      comparisons++
      if (comparisons % YIELD_EVERY === 0) await yieldToEventLoop()
    }
  }

  const groupIndices = new Map<number, number[]>()
  for (let i = 0; i < cached.length; i++) {
    const root = disjointSet.find(i)
    const indices = groupIndices.get(root)
    if (indices) indices.push(i)
    else groupIndices.set(root, [i])
  }

  // The cluster spanning the most distinct years is the most
  // "throwback"-worthy set to show.
  let best: { indices: number[]; years: Set<number> } | null = null
  for (const indices of groupIndices.values()) {
    const years = new Set(indices.map((i) => yearByPath.get(cached[i].filePath)!))
    if (years.size < 2) continue
    if (!best || years.size > best.years.size) best = { indices, years }
  }
  if (!best) return null

  // At most one photo per year within the winning cluster — pick whichever
  // has the highest average similarity to the rest of the group.
  const indicesByYear = new Map<number, number[]>()
  for (const i of best.indices) {
    const year = yearByPath.get(cached[i].filePath)!
    const list = indicesByYear.get(year)
    if (list) list.push(i)
    else indicesByYear.set(year, [i])
  }

  const entries: ThrowbackEntry[] = []
  for (const [year, indices] of indicesByYear) {
    let bestIndex = indices[0]
    let bestScore = -Infinity
    for (const i of indices) {
      let total = 0
      for (const j of best.indices) {
        if (j !== i) total += cosineSimilarity(cached[i].embedding, cached[j].embedding)
      }
      if (total > bestScore) {
        bestScore = total
        bestIndex = i
      }
    }
    entries.push({ year, filePath: cached[bestIndex].filePath })
  }

  entries.sort((a, b) => a.year - b.year)
  return entries
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
