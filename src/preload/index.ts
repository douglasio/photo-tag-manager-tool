import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  MetadataBatchEvent,
  PhotoRecord,
  ScanCompleteEvent,
  ScanProgressEvent,
  ScanStartResult,
  WatchPhotoRemovedEvent,
  WatchPhotoUpsertedEvent
} from '../shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  getFolders: (): Promise<string[]> => ipcRenderer.invoke('settings:getFolders'),
  addFolder: (folder: string): Promise<void> => ipcRenderer.invoke('settings:addFolder', folder),
  removeFolder: (folder: string): Promise<void> =>
    ipcRenderer.invoke('settings:removeFolder', folder),
  startScan: (rootPath: string): Promise<ScanStartResult> =>
    ipcRenderer.invoke('scan:start', rootPath),
  cancelScan: (scanId: string): Promise<void> => ipcRenderer.invoke('scan:cancel', scanId),
  updateTags: (filePath: string, tags: string[]): Promise<PhotoRecord> =>
    ipcRenderer.invoke('tags:update', filePath, tags),
  onScanProgress: (callback: (payload: ScanProgressEvent) => void): (() => void) =>
    subscribe('scan:progress', callback),
  onMetadataBatch: (callback: (payload: MetadataBatchEvent) => void): (() => void) =>
    subscribe('scan:metadata-batch', callback),
  onScanComplete: (callback: (payload: ScanCompleteEvent) => void): (() => void) =>
    subscribe('scan:complete', callback),
  onPhotoUpserted: (callback: (payload: WatchPhotoUpsertedEvent) => void): (() => void) =>
    subscribe('watch:photo-upserted', callback),
  onPhotoRemoved: (callback: (payload: WatchPhotoRemovedEvent) => void): (() => void) =>
    subscribe('watch:photo-removed', callback)
}

export type PhotagApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
