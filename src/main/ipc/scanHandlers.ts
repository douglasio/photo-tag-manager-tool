import { randomUUID } from 'crypto'
import { ipcMain, type WebContents } from 'electron'
import pLimitImport from 'p-limit'

import { findManyByPathPrefix, pruneMissing, upsertPhotosBatch } from '@main/db/photoRepository'
import { getExcludePatterns } from '@main/db/settingsRepository'
import { scanAllFolders, scanDirectory } from '@main/services/directoryScanner'
import { kickIndexer } from '@main/services/embeddingIndexService'
import { kickFaceIndexer } from '@main/services/faceIndexService'
import { ingestMetadata, ingestThumbnail } from '@main/services/photoIngest'
import { deleteThumbnail } from '@main/services/thumbnailService'
import type {
  MetadataBatchEvent,
  PhotoRecord,
  ScanCompleteEvent,
  ScanPhase,
  ScanProgressEvent,
  ScanStartResult
} from '@shared/types'

// p-limit is ESM-only; when externalized in the main-process CJS bundle,
// `require('p-limit')` yields the module namespace object rather than the
// callable default export, so it must be unwrapped explicitly.
const pLimit =
  (pLimitImport as unknown as { default?: typeof pLimitImport }).default ?? pLimitImport

const METADATA_CONCURRENCY = 6
const THUMBNAIL_CONCURRENCY = 4
// Raised from 30/120ms — at the old size, a 50k-photo first-time scan fired
// ~3,300 scan:metadata-batch events, each triggering a full photosByPath
// Map clone in the renderer (cost proportional to the *current* map size,
// not the batch size), adding up to a quadratic total. Larger batches cut
// that dispatch count by ~15x; the time-based flush still keeps the fill
// progressive for anything slower than this (real EXIF/thumbnail work).
const BATCH_INTERVAL_MS = 200
const BATCH_SIZE = 500
// Same reasoning as BATCH_SIZE above, applied to the DB side: each row
// upserted outside an explicit transaction is its own implicit commit in
// better-sqlite3. Chunking writes amortizes that to one commit per chunk.
const WRITE_BATCH_SIZE = 500
// Matches faceDetection.ts's PROGRESS_INTERVAL_MS — throttles scan:progress
// to a running counter instead of the renderer deriving "done" from the
// size of photosByPath (see PhotoLibraryScanProgressContext).
const PROGRESS_INTERVAL_MS = 150

interface ScanState {
  cancelled: boolean
}

const activeScans = new Map<string, ScanState>()

function startScan(sender: WebContents, rootPaths: string[]): ScanStartResult {
  const scanId = randomUUID()
  const state: ScanState = { cancelled: false }
  activeScans.set(scanId, state)

  runScan(scanId, rootPaths, sender, state)
    .catch((err) => console.error(`scan ${scanId} failed`, err))
    .finally(() => activeScans.delete(scanId))

  return { scanId }
}

export function registerScanHandlers(): void {
  ipcMain.handle('scan:start', (event, rootPath: string) => startScan(event.sender, [rootPath]))

  // Combines every given root into one scan (one scanId, one shared
  // metadata/thumbnail concurrency pool) instead of the renderer awaiting
  // each folder's own separate scan one at a time — see PhotoLibraryContext's
  // startScanForAll, used for the startup sweep and "rescan all."
  ipcMain.handle('scan:startAll', (event, rootPaths: string[]) =>
    startScan(event.sender, rootPaths)
  )

  ipcMain.handle('scan:cancel', (_event, scanId: string) => {
    const state = activeScans.get(scanId)
    if (state) state.cancelled = true
  })
}

async function runScan(
  scanId: string,
  rootPaths: string[],
  sender: WebContents,
  state: ScanState
): Promise<void> {
  const emitProgress = (phase: ScanPhase, done: number, total: number): void => {
    const progressEvent: ScanProgressEvent = { scanId, phase, done, total }
    sender.send('scan:progress', progressEvent)
  }
  emitProgress('enumerating', 0, 0)

  let filePaths: string[]
  let allFolders: string[]
  try {
    const excludePatterns = getExcludePatterns()
    const perRoot = await Promise.all(
      rootPaths.map((rootPath) =>
        Promise.all([
          scanDirectory(rootPath, excludePatterns),
          scanAllFolders(rootPath, excludePatterns)
        ])
      )
    )
    filePaths = perRoot.flatMap(([files]) => files)
    allFolders = perRoot.flatMap(([, folders]) => folders)
  } catch (err) {
    const completeEvent: ScanCompleteEvent = {
      scanId,
      rootPaths,
      totalScanned: 0,
      cacheHits: 0,
      errors: [
        {
          filePath: rootPaths.join(', '),
          message: err instanceof Error ? err.message : String(err)
        }
      ],
      allFolders: [],
      // Enumeration itself failed — this isn't an authoritative "nothing
      // exists here" result, so the renderer must not prune based on it.
      filePaths: null
    }
    sender.send('scan:complete', completeEvent)
    return
  }
  if (state.cancelled) return

  const total = filePaths.length
  emitProgress('reading', 0, total)

  // Bulk cache lookup, replacing one findByPath call (a synchronous SQLite
  // round trip) per file with a handful of prefix queries, one per root.
  const cache = findManyByPathPrefix(rootPaths)

  const seenPaths = new Set(filePaths)
  const metadataLimit = pLimit(METADATA_CONCURRENCY)
  const thumbnailLimit = pLimit(THUMBNAIL_CONCURRENCY)

  let cacheHits = 0
  let done = 0
  let lastProgressAt = 0
  const errors: ScanCompleteEvent['errors'] = []
  let pendingBatch: PhotoRecord[] = []
  let lastFlush = Date.now()

  const flush = (force = false): void => {
    if (pendingBatch.length === 0) return
    if (!force && pendingBatch.length < BATCH_SIZE && Date.now() - lastFlush < BATCH_INTERVAL_MS)
      return
    const batchEvent: MetadataBatchEvent = { scanId, photos: pendingBatch }
    sender.send('scan:metadata-batch', batchEvent)
    pendingBatch = []
    lastFlush = Date.now()
  }

  const flushInterval = setInterval(() => flush(), BATCH_INTERVAL_MS)

  // New/changed rows are collected here instead of written inline — see
  // upsertPhotosBatch. A cache hit never reaches this (ingestMetadata only
  // calls deferredWrite on a miss), so this stays empty on a warm rescan.
  let writeBuffer: { record: PhotoRecord; mtimeMs: number; sizeBytes: number }[] = []
  const flushWrites = (force = false): void => {
    if (writeBuffer.length === 0) return
    if (!force && writeBuffer.length < WRITE_BATCH_SIZE) return
    const batch = writeBuffer
    writeBuffer = []
    upsertPhotosBatch(batch)
  }
  const deferredWrite = (entry: {
    record: PhotoRecord
    mtimeMs: number
    sizeBytes: number
  }): void => {
    writeBuffer.push(entry)
    flushWrites()
  }

  // Thumbnail generation is intentionally *not* awaited inline here — doing
  // so would hold a metadata slot open for the full duration of that file's
  // thumbnail work too, throttling metadata-read throughput down to
  // thumbnail-generation throughput even though the two have their own,
  // independent p-limits. Instead each file's thumbnail work (once queued
  // under thumbnailLimit) is collected here and awaited together, after
  // every file's metadata step has had a chance to run at full speed.
  const thumbnailTasks: Promise<void>[] = []

  await Promise.all(
    filePaths.map((filePath) =>
      metadataLimit(async () => {
        if (state.cancelled) return
        try {
          const { photo, fromCache, fileStat } = await ingestMetadata(filePath, {
            prefetched: cache.get(filePath) ?? null,
            deferredWrite
          })
          if (fromCache) cacheHits++
          pendingBatch.push(photo)
          flush()

          if (photo.thumbnailStatus !== 'ready') {
            thumbnailTasks.push(
              thumbnailLimit(async () => {
                if (state.cancelled) return
                const updated = await ingestThumbnail(filePath, photo, fileStat)
                pendingBatch.push(updated)
                flush()
              })
            )
          }
        } catch (err) {
          errors.push({ filePath, message: err instanceof Error ? err.message : String(err) })
        } finally {
          done++
          const now = Date.now()
          if (done === total || now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
            lastProgressAt = now
            emitProgress('reading', done, total)
          }
        }
      })
    )
  )

  // Every metadata step (and therefore every thumbnail task it might have
  // queued) has resolved by now, but thumbnails run on their own pace and
  // may still be finishing — wait for those too before declaring this scan done.
  await Promise.all(thumbnailTasks)

  emitProgress('finalizing', total, total)
  clearInterval(flushInterval)
  flush(true)
  // Must happen before kickIndexer/kickFaceIndexer below — both query the
  // photos table directly, so a row still sitting in writeBuffer is
  // invisible to them and would silently miss this scan's indexing pass.
  flushWrites(true)

  const removedThumbnailKeys = state.cancelled
    ? []
    : rootPaths.flatMap((rootPath) => pruneMissing(rootPath, seenPaths))
  await Promise.all(removedThumbnailKeys.map((key) => deleteThumbnail(key)))

  const completeEvent: ScanCompleteEvent = {
    scanId,
    rootPaths,
    totalScanned: filePaths.length,
    cacheHits,
    errors,
    allFolders,
    // Mirrors the pruneMissing skip above — a cancelled scan didn't finish
    // reconciling the DB, so the renderer shouldn't reconcile its own state
    // against a set that DB-side deliberately left unapplied.
    filePaths: state.cancelled ? null : filePaths
  }
  // Newly-ready photos need embedding for visual search and face detection —
  // nothing else follows up on either outside an explicit scan/rescan.
  kickIndexer()
  kickFaceIndexer()
  sender.send('scan:complete', completeEvent)
}
