import { randomUUID } from 'crypto'
import { ipcMain, type WebContents } from 'electron'
import pLimitImport from 'p-limit'

import { pruneMissing } from '@main/db/photoRepository'
import { getExcludePatterns } from '@main/db/settingsRepository'
import { scanAllFolders, scanDirectory } from '@main/services/directoryScanner'
import { ingestMetadata, ingestThumbnail } from '@main/services/photoIngest'
import { deleteThumbnail } from '@main/services/thumbnailService'
import type {
  MetadataBatchEvent,
  PhotoRecord,
  ScanCompleteEvent,
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
const BATCH_INTERVAL_MS = 120
const BATCH_SIZE = 30

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

  const progressEvent: ScanProgressEvent = { scanId, filesFound: filePaths.length }
  sender.send('scan:progress', progressEvent)

  const seenPaths = new Set(filePaths)
  const metadataLimit = pLimit(METADATA_CONCURRENCY)
  const thumbnailLimit = pLimit(THUMBNAIL_CONCURRENCY)

  let cacheHits = 0
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
          const { photo, fromCache, fileStat } = await ingestMetadata(filePath)
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
        }
      })
    )
  )

  // Every metadata step (and therefore every thumbnail task it might have
  // queued) has resolved by now, but thumbnails run on their own pace and
  // may still be finishing — wait for those too before declaring this scan done.
  await Promise.all(thumbnailTasks)

  clearInterval(flushInterval)
  flush(true)

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
  sender.send('scan:complete', completeEvent)
}
