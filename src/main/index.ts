import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'

// eslint-disable-next-line no-restricted-imports -- resources/ lives outside src/, so no alias covers it
import icon from '../../resources/icon.png?asset'
import { getFolders } from './db/settingsRepository'
import { registerDialogHandlers } from './ipc/dialogHandlers'
import { registerPhotoHandlers } from './ipc/photoHandlers'
import { registerScanHandlers } from './ipc/scanHandlers'
import { registerSettingsHandlers } from './ipc/settingsHandlers'
import { registerShellHandlers } from './ipc/shellHandlers'
import { registerTagHandlers } from './ipc/tagHandlers'
import { registerFileProtocolHandler, registerFileProtocolScheme } from './protocols/fileProtocol'
import {
  registerThumbProtocolHandler,
  registerThumbProtocolScheme
} from './protocols/thumbProtocol'
import { shutdownExifTool } from './services/metadataService'
import { setWatchTarget, unwatchAllFolders, watchFolder } from './services/watchManager'

app.setName('Tag Me')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  registerThumbProtocolScheme()
  registerFileProtocolScheme()

  let mainWindow: BrowserWindow | null = null

  function createWindow(): void {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

    mainWindow = new BrowserWindow({
      width: Math.round(screenWidth * 0.8),
      height: Math.round(screenHeight * 0.8),
      center: true,
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

    // Electron's default (unset) application menu binds Ctrl/Cmd+Plus, Minus,
    // and 0 to its own built-in whole-page zoom, independent of any renderer
    // keydown listener — that accelerator was firing alongside PhotoView's
    // own Ctrl+-/+ zoom-slider shortcuts, which looked like "zoom out doesn't
    // work" once the slider was already at its minimum and only the native
    // page-zoom effect remained visible.
    mainWindow.webContents.on('zoom-changed', (event) => {
      event.preventDefault()
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
    registerPhotoHandlers()
    registerShellHandlers()
    registerScanHandlers()
    registerSettingsHandlers()
    registerTagHandlers()

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
