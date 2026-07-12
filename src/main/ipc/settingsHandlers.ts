import { ipcMain } from 'electron'
import { getFolders, setFolders } from '../db/settingsRepository'
import { pruneMissing } from '../db/photoRepository'
import { deleteThumbnail } from '../services/thumbnailService'
import { watchFolder, unwatchFolder } from '../services/watchManager'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getFolders', () => getFolders())

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
}
