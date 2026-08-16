import { is } from '@electron-toolkit/utils'
import { app } from 'electron'
import { join } from 'path'

// YuNet/SFace ship as bundled app assets (see resources/models/)
export function getModelPath(fileName: string): string {
  if (is.dev) {
    return join(app.getAppPath(), 'resources', 'models', fileName)
  }
  return join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'models', fileName)
}
