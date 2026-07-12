import { ipcMain } from 'electron'
import { getFolders, setFolders } from '../db/settingsRepository'
import { pruneMissing } from '../db/photoRepository'
import { deleteThumbnail } from '../services/thumbnailService'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getFolders', () => getFolders())

  ipcMain.handle('settings:addFolder', (_event, folder: string) => {
    const folders = getFolders()
    if (!folders.includes(folder)) {
      setFolders([...folders, folder])
    }
  })

  ipcMain.handle('settings:removeFolder', async (_event, folder: string) => {
    const folders = getFolders().filter((f) => f !== folder)
    setFolders(folders)

    const removedThumbnailKeys = pruneMissing(folder, new Set())
    await Promise.all(removedThumbnailKeys.map((key) => deleteThumbnail(key)))
  })
}
