import { dialog, ipcMain } from 'electron'

import {
  clearLibrary,
  exportDatabase,
  importDatabase,
  validateDatabaseFile
} from '@main/services/libraryDataService'

const DB_FILE_FILTER = { name: 'SQLite Database', extensions: ['db'] }

function defaultBackupFileName(): string {
  const date = new Date().toISOString().slice(0, 10)
  return `photag-backup-${date}.db`
}

export function registerLibraryDataHandlers(): void {
  // Returns false if the user canceled the save dialog, true once the
  // backup actually wrote — a non-destructive, no-confirmation action.
  ipcMain.handle('library:exportDatabase', async (): Promise<boolean> => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultBackupFileName(),
      filters: [DB_FILE_FILTER]
    })
    if (result.canceled || !result.filePath) return false

    await exportDatabase(result.filePath)
    return true
  })

  // Resolves with no error if the user cancels the file picker (a no-op);
  // throws if the picked file isn't a real Tag Me database, for the
  // renderer's confirmation dialog to surface inline. On success this never
  // actually returns — the app relaunches against the replaced database.
  ipcMain.handle('library:importDatabase', async (): Promise<void> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [DB_FILE_FILTER]
    })
    if (result.canceled || result.filePaths.length === 0) return

    const filePath = result.filePaths[0]
    if (!validateDatabaseFile(filePath)) {
      throw new Error("That file doesn't look like a Tag Me database.")
    }

    await importDatabase(filePath)
  })

  // Never actually returns on success — the app relaunches into an empty
  // library once every table, thumbnail, and downloaded AI model is wiped.
  ipcMain.handle('library:clearLibrary', async (): Promise<void> => {
    await clearLibrary()
  })
}
