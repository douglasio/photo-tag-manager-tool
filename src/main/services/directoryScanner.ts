import { fdir } from 'fdir'
import { SUPPORTED_EXTENSIONS } from './supportedExtensions'

export async function scanDirectory(rootPath: string): Promise<string[]> {
  return new fdir()
    .withFullPaths()
    .filter((path, isDirectory) => {
      if (isDirectory) return false
      const dot = path.lastIndexOf('.')
      if (dot === -1) return false
      return SUPPORTED_EXTENSIONS.has(path.slice(dot).toLowerCase())
    })
    .crawl(rootPath)
    .withPromise()
}
