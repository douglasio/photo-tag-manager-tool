import { ElectronAPI } from '@electron-toolkit/preload'
import type { PhotagApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: PhotagApi
  }
}
