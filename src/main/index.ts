import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'

// eslint-disable-next-line no-restricted-imports -- resources/ lives outside src/, so no alias covers it
import icon from '../../resources/icon.png?asset'
import { getFolders, getWindowState } from './db/settingsRepository'
import { registerAiHandlers } from './ipc/aiHandlers'
import { registerDialogHandlers } from './ipc/dialogHandlers'
import { registerFaceHandlers } from './ipc/faceHandlers'
import { registerFolderHandlers } from './ipc/folderHandlers'
import { registerLibraryDataHandlers } from './ipc/libraryDataHandlers'
import { registerPhotoHandlers } from './ipc/photoHandlers'
import { registerScanHandlers } from './ipc/scanHandlers'
import { registerSettingsHandlers } from './ipc/settingsHandlers'
import { registerShellHandlers } from './ipc/shellHandlers'
import { registerTagHandlers } from './ipc/tagHandlers'
import { registerThrowbackHandlers } from './ipc/throwbackHandlers'
import { registerFileProtocolHandler, registerFileProtocolScheme } from './protocols/fileProtocol'
import {
  registerThumbProtocolHandler,
  registerThumbProtocolScheme
} from './protocols/thumbProtocol'
import { shutdownExifTool } from './services/metadataService'
import { setWatchTarget, unwatchAllFolders, watchFolder } from './services/watchManager'
import {
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  resolveWindowBounds,
  trackWindowState
} from './services/windowStateService'

app.setName('Tag Me')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  registerThumbProtocolScheme()
  registerFileProtocolScheme()

  let mainWindow: BrowserWindow | null = null

  function createWindow(): void {
    const { maximized, ...bounds } = resolveWindowBounds(
      getWindowState(),
      screen.getPrimaryDisplay().workArea,
      screen.getAllDisplays().map((display) => display.workArea)
    )

    mainWindow = new BrowserWindow({
      ...bounds,
      show: false,
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    mainWindow.setMinimumSize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
    // Maximize before first paint so the window never flashes at its restored
    // size on the way to full screen.
    if (maximized) mainWindow.maximize()
    trackWindowState(mainWindow)

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
    registerFolderHandlers()
    registerTagHandlers()
    registerAiHandlers()
    registerFaceHandlers()
    registerThrowbackHandlers()
    registerLibraryDataHandlers()

    createWindow()

    if (mainWindow) {
      setWatchTarget(mainWindow.webContents)
      getFolders().forEach(watchFolder)
    }

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
        // Watcher events were pointed at the previous (now destroyed)
        // window's webContents — re-target them at the new one.
        if (mainWindow) setWatchTarget(mainWindow.webContents)
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    // Deliberately NOT canceling/disposing an in-flight AI scan here: doing
    // so used to synchronously reject the scan's in-flight worker request,
    // which tripped runFullAiScan's `finally` and cleared the persisted
    // "scan in progress" flag before the process actually exited — silently
    // undoing resume-on-launch. Letting the process die untouched leaves
    // that flag exactly as it was, so the next launch resumes correctly;
    // the OS reclaims the worker threads on process exit regardless.
    void shutdownExifTool()
    void unwatchAllFolders()
  })
}
