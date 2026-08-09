import { ipcMain } from 'electron'

import {
  findThrowbackPreview,
  findThrowbackSimilarity,
  findThrowbackYearSample
} from '@main/services/throwbackService'
import type { ThrowbackEntry, ThrowbackYearSample } from '@shared/types'

// Read-only queries against whatever the shared embedding cache already
// holds — the scan that actually populates it (embedding + duplicate
// clustering) lives in aiScanService.ts/aiHandlers.ts now, shared with tag
// suggestions and duplicate detection instead of Time Warp running its own
// private copy.
export function registerThrowbackHandlers(): void {
  ipcMain.handle('throwback:getSimilarity', (): Promise<ThrowbackEntry[] | null> =>
    findThrowbackSimilarity()
  )

  ipcMain.handle('throwback:getYearSample', (): ThrowbackYearSample | null =>
    findThrowbackYearSample()
  )

  ipcMain.handle('throwback:getPreview', (): ThrowbackEntry[] | null => findThrowbackPreview())
}
