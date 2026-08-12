import { ipcMain } from 'electron'
import { rename, stat } from 'fs/promises'
import { dirname, join } from 'path'

import { pruneMissing, renamePhotoPathPrefix } from '@main/db/photoRepository'
import {
  getAiTagSuggestionsEnabled,
  getDefaultView,
  getDetailsPanelCollapsed,
  getDvdStudioName,
  getExcludePatterns,
  getFolders,
  getGalleryAnimationsEnabled,
  getGalleryCellWidth,
  getGallerySort,
  getGalleryViewMode,
  getMagazineTitle,
  getNavbarSplitSizes,
  getNewspaperTitle,
  getShowEmptyFolders,
  getShowFilenames,
  getShowViewCounts,
  getTagsPanelGridView,
  setAiTagSuggestionsEnabled,
  setDefaultView,
  setDetailsPanelCollapsed,
  setDvdStudioName,
  setExcludePatterns,
  setFolders,
  setGalleryAnimationsEnabled,
  setGalleryCellWidth,
  setGallerySort,
  setGalleryViewMode,
  setMagazineTitle,
  setNavbarSplitSizes,
  setNewspaperTitle,
  setShowEmptyFolders,
  setShowFilenames,
  setShowViewCounts,
  setTagsPanelGridView
} from '@main/db/settingsRepository'
import { cancelAiScan } from '@main/services/aiScanService'
import { disposeDuplicateClusterWorker } from '@main/services/duplicatePhotoService'
import { disposeTagSuggestionWorker } from '@main/services/tagSuggestionService'
import { disposeThrowbackSimilarityWorker } from '@main/services/throwbackService'
import { deleteThumbnail } from '@main/services/thumbnailService'
import { restartAllWatchers, unwatchFolder, watchFolder } from '@main/services/watchManager'
import type { DefaultView, GallerySort, GalleryViewMode } from '@shared/types'

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

  ipcMain.handle('settings:getDefaultView', (): DefaultView => getDefaultView())

  ipcMain.handle('settings:setDefaultView', (_event, value: DefaultView): void => {
    setDefaultView(value)
  })

  ipcMain.handle('settings:getShowEmptyFolders', (): boolean => getShowEmptyFolders())

  ipcMain.handle('settings:setShowEmptyFolders', (_event, value: boolean): void => {
    setShowEmptyFolders(value)
  })

  ipcMain.handle('settings:getTagsPanelGridView', (): boolean => getTagsPanelGridView())

  ipcMain.handle('settings:setTagsPanelGridView', (_event, value: boolean): void => {
    setTagsPanelGridView(value)
  })

  ipcMain.handle('settings:getGalleryViewMode', (): GalleryViewMode => getGalleryViewMode())

  ipcMain.handle('settings:setGalleryViewMode', (_event, value: GalleryViewMode): void => {
    setGalleryViewMode(value)
  })

  ipcMain.handle('settings:getAiTagSuggestionsEnabled', (): boolean => getAiTagSuggestionsEnabled())

  // Turning it off also frees all three workers' memory (model
  // weights/session, and the clustering/similarity workers) rather than
  // leaving them loaded for a feature the user just disabled, and cancels
  // any scan still running.
  ipcMain.handle(
    'settings:setAiTagSuggestionsEnabled',
    async (_event, value: boolean): Promise<void> => {
      setAiTagSuggestionsEnabled(value)
      if (!value) {
        cancelAiScan()
        await Promise.all([
          disposeTagSuggestionWorker(),
          disposeDuplicateClusterWorker(),
          disposeThrowbackSimilarityWorker()
        ])
      }
    }
  )

  ipcMain.handle('settings:getDetailsPanelCollapsed', (): boolean => getDetailsPanelCollapsed())

  ipcMain.handle('settings:setDetailsPanelCollapsed', (_event, value: boolean): void => {
    setDetailsPanelCollapsed(value)
  })

  ipcMain.handle('settings:getGalleryAnimationsEnabled', (): boolean =>
    getGalleryAnimationsEnabled()
  )

  ipcMain.handle('settings:setGalleryAnimationsEnabled', (_event, value: boolean): void => {
    setGalleryAnimationsEnabled(value)
  })

  ipcMain.handle('settings:getShowFilenames', (): boolean => getShowFilenames())

  ipcMain.handle('settings:setShowFilenames', (_event, value: boolean): void => {
    setShowFilenames(value)
  })

  ipcMain.handle('settings:getShowViewCounts', (): boolean => getShowViewCounts())

  ipcMain.handle('settings:setShowViewCounts', (_event, value: boolean): void => {
    setShowViewCounts(value)
  })

  ipcMain.handle('settings:getMagazineTitle', (): string => getMagazineTitle())

  ipcMain.handle('settings:setMagazineTitle', (_event, value: string): void => {
    setMagazineTitle(value)
  })

  ipcMain.handle('settings:getNewspaperTitle', (): string => getNewspaperTitle())

  ipcMain.handle('settings:setNewspaperTitle', (_event, value: string): void => {
    setNewspaperTitle(value)
  })

  ipcMain.handle('settings:getDvdStudioName', (): string => getDvdStudioName())

  ipcMain.handle('settings:setDvdStudioName', (_event, value: string): void => {
    setDvdStudioName(value)
  })

  ipcMain.handle('settings:getNavbarSplitSizes', (): [number, number] | null =>
    getNavbarSplitSizes()
  )

  ipcMain.handle('settings:setNavbarSplitSizes', (_event, sizes: [number, number]): void => {
    setNavbarSplitSizes(sizes)
  })

  ipcMain.handle('settings:getExcludePatterns', (): string[] => getExcludePatterns())

  // Patterns can't be applied retroactively to an already-running watcher, so
  // every watched root's watcher is restarted with the new patterns baked in.
  // The renderer separately triggers a rescan (via rescanAll) to reconcile
  // the library itself against files/folders newly excluded or un-excluded.
  ipcMain.handle(
    'settings:setExcludePatterns',
    async (_event, patterns: string[]): Promise<void> => {
      setExcludePatterns(patterns)
      await restartAllWatchers(getFolders())
    }
  )

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
