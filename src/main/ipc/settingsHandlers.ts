import { ipcMain } from 'electron'
import { rename, stat } from 'fs/promises'
import { dirname, join } from 'path'
import {
  getFolders,
  setFolders,
  getGalleryCellWidth,
  setGalleryCellWidth,
  getGallerySort,
  setGallerySort,
  getShowEmptyFolders,
  setShowEmptyFolders
} from '../db/settingsRepository'
import type { GallerySort } from '../../shared/types'
import { pruneMissing, renamePhotoPathPrefix } from '../db/photoRepository'
import { deleteThumbnail } from '../services/thumbnailService'
import { watchFolder, unwatchFolder } from '../services/watchManager'

// Conservative cross-platform block list — matches photoHandlers.ts's file
// rename validation, since folder names share the same filesystem constraints.
const INVALID_FOLDER_NAME_CHARS = /[/\\:*?"<>|]/

function isPathUnderFolder(path: string, folder: string): boolean {
  if (!path.startsWith(folder)) return false
  const nextChar = path[folder.length]
  return nextChar === '/' || nextChar === '\\'
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getFolders', () => getFolders())

  ipcMain.handle('settings:getGalleryCellWidth', (): number | null => getGalleryCellWidth())

  ipcMain.handle('settings:setGalleryCellWidth', (_event, width: number): void => {
    setGalleryCellWidth(width)
  })

  ipcMain.handle('settings:getGallerySort', (): GallerySort | null => getGallerySort())

  ipcMain.handle('settings:setGallerySort', (_event, sort: GallerySort): void => {
    setGallerySort(sort)
  })

  ipcMain.handle('settings:getShowEmptyFolders', (): boolean => getShowEmptyFolders())

  ipcMain.handle('settings:setShowEmptyFolders', (_event, value: boolean): void => {
    setShowEmptyFolders(value)
  })

  ipcMain.handle('settings:addFolder', (_event, folder: string) => {
    const folders = getFolders()
    if (!folders.includes(folder)) {
      setFolders([...folders, folder])
    }
    watchFolder(folder)
  })

  ipcMain.handle('settings:removeFolder', async (_event, folder: string) => {
    const folders = getFolders().filter((f) => f !== folder)
    setFolders(folders)

    await unwatchFolder(folder)

    const removedThumbnailKeys = pruneMissing(folder, new Set())
    await Promise.all(removedThumbnailKeys.map((key) => deleteThumbnail(key)))
  })

  ipcMain.handle(
    'settings:renameFolder',
    async (_event, folder: string, newBaseName: string): Promise<string> => {
      const trimmed = newBaseName.trim()
      if (!trimmed) throw new Error('Folder name cannot be empty')
      if (INVALID_FOLDER_NAME_CHARS.test(trimmed)) {
        throw new Error('Folder name contains invalid characters')
      }

      const folders = getFolders()
      // The renamed folder can be a watched root itself, or any subfolder
      // nested under one — either way it needs the watched root that
      // actually owns the chokidar watcher covering it.
      const root = folders.find((f) => f === folder || isPathUnderFolder(folder, f))
      if (!root) throw new Error('Folder not found')

      const newPath = join(dirname(folder), trimmed)
      if (newPath === folder) return folder

      const alreadyExists = await stat(newPath).catch(() => null)
      if (alreadyExists) throw new Error('A folder with that name already exists')

      // Unwatch the containing ROOT (not just this folder) for the duration
      // of the rename, rather than reusing suppressNextEvent — chokidar
      // watches recursively from the root, so per-exact-path suppression
      // doesn't scale to the flood of unlink/add events a rename anywhere
      // inside it would otherwise cascade. Simpler to detach and reattach
      // the whole root's watcher once the rename (and DB update) are done.
      await unwatchFolder(root)
      await rename(folder, newPath)
      renamePhotoPathPrefix(folder, newPath)

      const isWatchedRoot = folder === root
      const newRoot = isWatchedRoot ? newPath : root
      if (isWatchedRoot) {
        setFolders(folders.map((f) => (f === folder ? newPath : f)))
      }
      watchFolder(newRoot)

      return newPath
    }
  )
}
