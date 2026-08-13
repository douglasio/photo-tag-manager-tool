// Single source of truth for "is this photo under an excluded folder" —
// imported by both the main process (filtering AI scan input at the
// repository layer) and the renderer (filtering gallery/tag/dashboard
// aggregates), so neither side reimplements this check independently.
// Excluding a folder also excludes every subfolder beneath it.
function isPathUnderFolder(path: string, folder: string): boolean {
  if (path === folder) return true
  if (!path.startsWith(folder)) return false
  const nextChar = path[folder.length]
  return nextChar === '/' || nextChar === '\\'
}

export function isUnderExcludedFolder(filePath: string, excludedFolders: string[]): boolean {
  return excludedFolders.some((folder) => isPathUnderFolder(filePath, folder))
}
