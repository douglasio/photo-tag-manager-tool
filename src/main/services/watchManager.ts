import type { WebContents } from 'electron'
import pLimitImport from 'p-limit'
import { startWatching, stopWatching, stopAllWatchers } from './folderWatcher'
import { ingestFile } from './photoIngest'
import { deleteThumbnail } from './thumbnailService'
import { removePhoto } from '../db/photoRepository'
import type {
  WatchFolderAddedEvent,
  WatchFolderRemovedEvent,
  WatchPhotoRemovedEvent,
  WatchPhotoUpsertedEvent
} from '../../shared/types'

// p-limit is ESM-only; when externalized in the main-process CJS bundle,
// `require('p-limit')` yields the module namespace object rather than the
// callable default export, so it must be unwrapped explicitly.
const pLimit =
  (pLimitImport as unknown as { default?: typeof pLimitImport }).default ?? pLimitImport

const THUMBNAIL_CONCURRENCY = 2
const thumbnailLimit = pLimit(THUMBNAIL_CONCURRENCY)

let watchTarget: WebContents | null = null

export function setWatchTarget(target: WebContents): void {
  watchTarget = target
}

// Lets a programmatic file operation (e.g. a rename) tell the watcher to
// ignore the filesystem event(s) it's about to cause, so the operation's own
// IPC response stays the single source of truth instead of racing a
// redundant unlink/add pair (which would also regenerate the thumbnail for
// nothing and could fire a spurious "photo added" toast).
const suppressedPaths = new Set<string>()
const SUPPRESSION_TIMEOUT_MS = 5000

export function suppressNextEvent(filePath: string): void {
  suppressedPaths.add(filePath)
  setTimeout(() => suppressedPaths.delete(filePath), SUPPRESSION_TIMEOUT_MS)
}

async function handleUpsert(filePath: string, changeType: 'add' | 'change'): Promise<void> {
  try {
    const { photo } = await ingestFile(filePath, thumbnailLimit)
    const payload: WatchPhotoUpsertedEvent = { photo, changeType }
    watchTarget?.send('watch:photo-upserted', payload)
  } catch (err) {
    console.error(`failed to ingest watched file ${filePath}`, err)
  }
}

async function handleRemove(filePath: string): Promise<void> {
  const thumbnailKey = removePhoto(filePath)
  if (thumbnailKey) await deleteThumbnail(thumbnailKey)
  const payload: WatchPhotoRemovedEvent = { filePath }
  watchTarget?.send('watch:photo-removed', payload)
}

export function watchFolder(rootPath: string): void {
  startWatching(rootPath, {
    onFileEvent: (type, filePath) => {
      if (suppressedPaths.delete(filePath)) return
      if (type === 'unlink') void handleRemove(filePath)
      else void handleUpsert(filePath, type)
    },
    onDirEvent: (type, dirPath) => {
      if (type === 'addDir') {
        const payload: WatchFolderAddedEvent = { folderPath: dirPath }
        watchTarget?.send('watch:folder-added', payload)
      } else {
        const payload: WatchFolderRemovedEvent = { folderPath: dirPath }
        watchTarget?.send('watch:folder-removed', payload)
      }
    }
  })
}

export function unwatchFolder(rootPath: string): Promise<void> {
  return stopWatching(rootPath)
}

export function unwatchAllFolders(): Promise<void> {
  return stopAllWatchers()
}
