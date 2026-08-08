import { ipcMain } from 'electron'

import { embedAllReadyPhotos } from '@main/services/photoEmbedding'
import {
  findThrowbackPreview,
  findThrowbackSimilarity,
  findThrowbackYearSample
} from '@main/services/throwbackService'
import type { ThrowbackEntry, ThrowbackYearSample } from '@shared/types'

// Owns the currently in-flight "Time Warp" scan's cancellation flag, if
// any — a fresh object per run so a cancel request from a previous
// (already-finished) run can never affect a new one.
let currentScan: { cancelled: boolean } | null = null

export function registerThrowbackHandlers(): void {
  ipcMain.handle('throwback:getSimilarity', (): Promise<ThrowbackEntry[] | null> =>
    findThrowbackSimilarity()
  )

  ipcMain.handle('throwback:getYearSample', (): ThrowbackYearSample | null =>
    findThrowbackYearSample()
  )

  ipcMain.handle('throwback:getPreview', (): ThrowbackEntry[] | null => findThrowbackPreview())

  ipcMain.handle('throwback:embedLibrary', async (event): Promise<void> => {
    const scan = { cancelled: false }
    currentScan = scan
    try {
      await embedAllReadyPhotos(
        (done, total) => {
          event.sender.send('throwback:embedLibraryProgress', { done, total })
        },
        () => scan.cancelled
      )
    } finally {
      if (currentScan === scan) currentScan = null
    }
  })

  ipcMain.handle('throwback:cancelEmbedLibrary', (): void => {
    if (currentScan) currentScan.cancelled = true
  })
}
