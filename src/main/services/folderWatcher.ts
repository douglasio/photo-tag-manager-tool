import { watch, type FSWatcher } from 'chokidar'
import { extname } from 'path'
import { SUPPORTED_EXTENSIONS } from './supportedExtensions'

export type WatchEventType = 'add' | 'change' | 'unlink'

interface WatcherHandlers {
  onFileEvent: (type: WatchEventType, filePath: string) => void
}

const watchers = new Map<string, FSWatcher>()

function isSupportedFile(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())
}

export function startWatching(rootPath: string, handlers: WatcherHandlers): void {
  if (watchers.has(rootPath)) return

  const watcher = watch(rootPath, {
    ignoreInitial: true,
    // Wait for copies/writes to finish before emitting add/change, so we don't
    // try to read metadata off a partially-written file.
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
  })

  watcher
    .on('add', (filePath) => {
      if (isSupportedFile(filePath)) handlers.onFileEvent('add', filePath)
    })
    .on('change', (filePath) => {
      if (isSupportedFile(filePath)) handlers.onFileEvent('change', filePath)
    })
    .on('unlink', (filePath) => {
      if (isSupportedFile(filePath)) handlers.onFileEvent('unlink', filePath)
    })
    .on('error', (err) => console.error(`folder watcher error for ${rootPath}`, err))

  watchers.set(rootPath, watcher)
}

export async function stopWatching(rootPath: string): Promise<void> {
  const watcher = watchers.get(rootPath)
  if (!watcher) return
  watchers.delete(rootPath)
  await watcher.close()
}

export async function stopAllWatchers(): Promise<void> {
  await Promise.all(Array.from(watchers.keys()).map(stopWatching))
}
