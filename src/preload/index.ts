import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  MetadataBatchEvent,
  ScanCompleteEvent,
  ScanProgressEvent,
  ScanStartResult
} from '../shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  startScan: (rootPath: string): Promise<ScanStartResult> =>
    ipcRenderer.invoke('scan:start', rootPath),
  cancelScan: (scanId: string): Promise<void> => ipcRenderer.invoke('scan:cancel', scanId),
  onScanProgress: (callback: (payload: ScanProgressEvent) => void): (() => void) =>
    subscribe('scan:progress', callback),
  onMetadataBatch: (callback: (payload: MetadataBatchEvent) => void): (() => void) =>
    subscribe('scan:metadata-batch', callback),
  onScanComplete: (callback: (payload: ScanCompleteEvent) => void): (() => void) =>
    subscribe('scan:complete', callback)
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
