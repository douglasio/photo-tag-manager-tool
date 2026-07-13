import { ipcMain, shell } from 'electron'

export function registerShellHandlers(): void {
  ipcMain.handle('show-item-in-folder', (_, path: string) => {
    shell.showItemInFolder(path)
  })
}
