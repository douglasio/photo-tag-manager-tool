import { is } from '@electron-toolkit/utils'
import { app } from 'electron'
import { join } from 'path'

// YuNet/SFace ship as bundled app assets (see resources/models/), not
// downloaded on first use like the CLIP models in tagSuggestionWorker.ts —
// electron-builder.yml's `asarUnpack: - resources/**` unpacks them to a real
// on-disk path (needed since onnxruntime-node's InferenceSession can't read
// out of an asar archive). In dev, resources/ lives at the project root
// instead. Resolved on the main thread (worker_threads can't use the
// `electron` module) and passed into the worker like tagSuggestionService
// passes its cacheDir.
export function getModelPath(fileName: string): string {
  if (is.dev) {
    return join(app.getAppPath(), 'resources', 'models', fileName)
  }
  return join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'models', fileName)
}
