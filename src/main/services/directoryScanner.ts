import { fdir } from 'fdir'

import { matchesExcludePattern } from './excludeMatcher'
import { SUPPORTED_EXTENSIONS } from './supportedExtensions'

export async function scanDirectory(
  rootPath: string,
  excludePatterns: string[] = []
): Promise<string[]> {
  return new fdir()
    .withFullPaths()
    .exclude((_dirName, dirPath) => matchesExcludePattern(dirPath, excludePatterns))
    .filter((path, isDirectory) => {
      if (isDirectory) return false
      if (matchesExcludePattern(path, excludePatterns)) return false
      const dot = path.lastIndexOf('.')
      if (dot === -1) return false
      return SUPPORTED_EXTENSIONS.has(path.slice(dot).toLowerCase())
    })
    .crawl(rootPath)
    .withPromise()
}

// Every folder under rootPath, including ones with no photos in them
export async function scanAllFolders(
  rootPath: string,
  excludePatterns: string[] = []
): Promise<string[]> {
  const dirs = await new fdir()
    .onlyDirs()
    .withFullPaths()
    .exclude((_dirName, dirPath) => matchesExcludePattern(dirPath, excludePatterns))
    .crawl(rootPath)
    .withPromise()
  // strip trailing separator it so these match the app's path convention
  const stripped = dirs.map((dir) => dir.replace(/[/\\]+$/, ''))
  return [rootPath, ...stripped.filter((dir) => dir !== rootPath)]
}
