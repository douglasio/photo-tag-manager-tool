import { ipcMain, shell } from 'electron'

export function registerShellHandlers(): void {
  ipcMain.handle('show-item-in-folder', (_, path: string) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle('open-photo', async (_, path: string): Promise<void> => {
    const error = await shell.openPath(path)
    if (error) throw new Error(error)
  })
}
