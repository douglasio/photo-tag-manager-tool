import { ipcMain, type WebContents } from 'electron'
import { randomUUID } from 'crypto'
import { stat } from 'fs/promises'
import pLimitImport from 'p-limit'
import { scanDirectory } from '../services/directoryScanner'
import { readPhotoRecord } from '../services/metadataService'
import { generateThumbnail, thumbnailKeyFor, deleteThumbnail } from '../services/thumbnailService'
import { findByPath, upsertPhoto, updateThumbnail, pruneMissing } from '../db/photoRepository'
import type {
  MetadataBatchEvent,
  PhotoRecord,
  ScanCompleteEvent,
  ScanProgressEvent
} from '../../shared/types'

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

export function registerScanHandlers(): void {
  ipcMain.handle('scan:start', (event, rootPath: string) => {
    const scanId = randomUUID()
    const state: ScanState = { cancelled: false }
    activeScans.set(scanId, state)

    runScan(scanId, rootPath, event.sender, state)
      .catch((err) => console.error(`scan ${scanId} failed`, err))
      .finally(() => activeScans.delete(scanId))

    return { scanId }
  })

  ipcMain.handle('scan:cancel', (_event, scanId: string) => {
    const state = activeScans.get(scanId)
    if (state) state.cancelled = true
  })
}

async function processFile(
  filePath: string,
  thumbnailLimit: <T>(fn: () => Promise<T>) => Promise<T>
): Promise<{ photo: PhotoRecord; fromCache: boolean }> {
  const fileStat = await stat(filePath)
  const cached = findByPath(filePath)

  let photo: PhotoRecord
  let fromCache = false

  if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.sizeBytes === fileStat.size) {
    photo = cached.record
    fromCache = true
  } else {
    photo = await readPhotoRecord(filePath)
    upsertPhoto(photo, fileStat.mtimeMs, fileStat.size)
  }

  if (photo.thumbnailStatus !== 'ready') {
    const key = thumbnailKeyFor(filePath, fileStat.mtimeMs, fileStat.size)
    await thumbnailLimit(async () => {
      try {
        await generateThumbnail(filePath, key)
        updateThumbnail(filePath, key, 'ready')
        photo = { ...photo, thumbnailStatus: 'ready', thumbnailKey: key }
      } catch {
        updateThumbnail(filePath, key, 'error')
        photo = { ...photo, thumbnailStatus: 'error', thumbnailKey: null }
      }
    })
  }

  return { photo, fromCache }
}

async function runScan(
  scanId: string,
  rootPath: string,
  sender: WebContents,
  state: ScanState
): Promise<void> {
  const filePaths = await scanDirectory(rootPath)
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

  await Promise.all(
    filePaths.map((filePath) =>
      metadataLimit(async () => {
        if (state.cancelled) return
        try {
          const result = await processFile(filePath, thumbnailLimit)
          if (result.fromCache) cacheHits++
          pendingBatch.push(result.photo)
          flush()
        } catch (err) {
          errors.push({ filePath, message: err instanceof Error ? err.message : String(err) })
        }
      })
    )
  )

  clearInterval(flushInterval)
  flush(true)

  const removedThumbnailKeys = state.cancelled ? [] : pruneMissing(rootPath, seenPaths)
  await Promise.all(removedThumbnailKeys.map((key) => deleteThumbnail(key)))

  const completeEvent: ScanCompleteEvent = {
    scanId,
    totalScanned: filePaths.length,
    cacheHits,
    errors
  }
  sender.send('scan:complete', completeEvent)
}
