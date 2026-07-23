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

// Every folder under rootPath, including ones with no photos in them — the
// gallery's folder tree is otherwise built entirely from photo paths, so an
// empty folder (or one containing only unsupported files) would never appear
// anywhere without this separate listing. Includes rootPath itself so a
// caller doesn't need to special-case adding it back in.
export async function scanAllFolders(rootPath: string): Promise<string[]> {
  const dirs = await new fdir().onlyDirs().withFullPaths().crawl(rootPath).withPromise()
  // fdir appends a trailing separator to directory entries — strip it so
  // these match the app's path convention (no trailing slash) used
  // everywhere folder paths derived from photo paths already appear.
  return [rootPath, ...dirs.map((dir) => dir.replace(/[/\\]+$/, ''))]
}
