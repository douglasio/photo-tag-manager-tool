import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerDialogHandlers } from './ipc/dialogHandlers'
import { registerScanHandlers } from './ipc/scanHandlers'
import { registerSettingsHandlers } from './ipc/settingsHandlers'
import {
  registerThumbProtocolHandler,
  registerThumbProtocolScheme
} from './protocols/thumbProtocol'
import { registerFileProtocolHandler, registerFileProtocolScheme } from './protocols/fileProtocol'
import { shutdownExifTool } from './services/metadataService'
import { getFolders } from './db/settingsRepository'
import { setWatchTarget, watchFolder, unwatchAllFolders } from './services/watchManager'

app.setName('Tag Me')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  registerThumbProtocolScheme()
  registerFileProtocolScheme()

  let mainWindow: BrowserWindow | null = null

  function createWindow(): void {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    mainWindow.on('ready-to-show', () => {
      mainWindow?.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.tagme.app')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerThumbProtocolHandler()
    registerFileProtocolHandler()
    registerDialogHandlers()
    registerScanHandlers()
    registerSettingsHandlers()

    createWindow()

    if (mainWindow) {
      setWatchTarget(mainWindow.webContents)
      getFolders().forEach(watchFolder)
    }

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    void shutdownExifTool()
    void unwatchAllFolders()
  })
}
