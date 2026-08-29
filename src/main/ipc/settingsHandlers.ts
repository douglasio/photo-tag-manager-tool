import { ipcMain } from 'electron'

import { clearAllFaceData } from '@main/db/faceRepository'
import { clearAllFaceScanMarks } from '@main/db/photoRepository'
import {
  getAllSettings,
  getFolders,
  setAiTagSuggestionsEnabled,
  setArtGalleryName,
  setDefaultView,
  setDetailsPanelCollapsed,
  setDvdStudioName,
  setExcludedFolders,
  setExcludePatterns,
  setFaceDetectionEnabled,
  setGalleryAnimationsEnabled,
  setGalleryCellWidth,
  setGallerySort,
  setGalleryViewMode,
  setMagazineTitle,
  setNavbarCollapsedPanels,
  setNavbarSplitSizes,
  setNavbarWidth,
  setNewspaperTitle,
  setPeoplePanelGridView,
  setShowEmptyFolders,
  setShowFilenames,
  setShowViewCounts,
  setTagsPanelGridView
} from '@main/db/settingsRepository'
import { cancelAiScan } from '@main/services/aiScanService'
import { disposeDuplicateClusterWorker } from '@main/services/duplicatePhotoService'
import { disposeFaceClusterWorker } from '@main/services/faceClustering'
import { disposeFaceDetectionWorker } from '@main/services/faceDetectionService'
import { resumeFaceIndexer, stopFaceIndexer } from '@main/services/faceIndexService'
import { cancelFaceScan } from '@main/services/faceScanService'
import { disposeTagSuggestionWorker } from '@main/services/tagSuggestionService'
import { disposeThrowbackSimilarityWorker } from '@main/services/throwbackService'
import { restartAllWatchers } from '@main/services/watchManager'
import type { AppSettings, DefaultView, GallerySort, GalleryViewMode } from '@shared/types'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getAllSettings', (): AppSettings => getAllSettings())

  ipcMain.handle('settings:setGalleryCellWidth', (_event, width: number): void => {
    setGalleryCellWidth(width)
  })

  ipcMain.handle('settings:setGallerySort', (_event, sort: GallerySort): void => {
    setGallerySort(sort)
  })

  ipcMain.handle('settings:setDefaultView', (_event, value: DefaultView): void => {
    setDefaultView(value)
  })

  ipcMain.handle('settings:setShowEmptyFolders', (_event, value: boolean): void => {
    setShowEmptyFolders(value)
  })

  ipcMain.handle('settings:setTagsPanelGridView', (_event, value: boolean): void => {
    setTagsPanelGridView(value)
  })

  ipcMain.handle('settings:setPeoplePanelGridView', (_event, value: boolean): void => {
    setPeoplePanelGridView(value)
  })

  ipcMain.handle('settings:setGalleryViewMode', (_event, value: GalleryViewMode): void => {
    setGalleryViewMode(value)
  })

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

  // Turning it off is a full reset, not a pause: frees both face workers'
  // memory (detection/ONNX sessions, clustering), cancels any scan still
  // running, and wipes every detected face/person — re-enabling later always
  // starts a genuinely fresh scan rather than resuming from stale data.
  ipcMain.handle(
    'settings:setFaceDetectionEnabled',
    async (_event, value: boolean): Promise<void> => {
      setFaceDetectionEnabled(value)
      if (!value) {
        cancelFaceScan()
        await stopFaceIndexer()
        await Promise.all([disposeFaceDetectionWorker(), disposeFaceClusterWorker()])
        clearAllFaceData()
        clearAllFaceScanMarks()
      } else {
        resumeFaceIndexer()
      }
    }
  )

  ipcMain.handle('settings:setDetailsPanelCollapsed', (_event, value: boolean): void => {
    setDetailsPanelCollapsed(value)
  })

  ipcMain.handle('settings:setGalleryAnimationsEnabled', (_event, value: boolean): void => {
    setGalleryAnimationsEnabled(value)
  })

  ipcMain.handle('settings:setShowFilenames', (_event, value: boolean): void => {
    setShowFilenames(value)
  })

  ipcMain.handle('settings:setShowViewCounts', (_event, value: boolean): void => {
    setShowViewCounts(value)
  })

  ipcMain.handle('settings:setMagazineTitle', (_event, value: string): void => {
    setMagazineTitle(value)
  })

  ipcMain.handle('settings:setNewspaperTitle', (_event, value: string): void => {
    setNewspaperTitle(value)
  })

  ipcMain.handle('settings:setDvdStudioName', (_event, value: string): void => {
    setDvdStudioName(value)
  })

  ipcMain.handle('settings:setArtGalleryName', (_event, value: string): void => {
    setArtGalleryName(value)
  })

  ipcMain.handle('settings:setNavbarSplitSizes', (_event, sizes: number[]): void => {
    setNavbarSplitSizes(sizes)
  })

  ipcMain.handle('settings:setNavbarWidth', (_event, width: number): void => {
    setNavbarWidth(width)
  })

  ipcMain.handle(
    'settings:setNavbarCollapsedPanels',
    (_event, value: Record<string, boolean>): void => {
      setNavbarCollapsedPanels(value)
    }
  )

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

  // Unlike excludePatterns, this never touches scanning/watching — excluded
  // photos stay fully ingested, just filtered out of AI/tag/dashboard
  // aggregates at query time (photoRepository/embeddingRepository).
  ipcMain.handle('settings:setExcludedFolders', (_event, folders: string[]): void => {
    setExcludedFolders(folders)
  })
}
