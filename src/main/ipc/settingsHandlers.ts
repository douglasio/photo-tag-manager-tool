import { ipcMain } from 'electron'
import { getSetting } from '../db/settingsRepository'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getLastFolder', () => getSetting('lastFolder'))
}
