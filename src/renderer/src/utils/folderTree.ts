import type { TreeNodeData } from '@mantine/core'

function dirname(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx === -1 ? path : path.slice(0, idx)
}

export function basename(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx === -1 ? path : path.slice(idx + 1)
}

export function isPhotoInFolder(filePath: string, folder: string): boolean {
  if (!filePath.startsWith(folder)) return false
  const nextChar = filePath[folder.length]
  return nextChar === '/' || nextChar === '\\'
}

/** Like isPhotoInFolder, but also true when path is the ancestor folder itself. */
export function isPathUnderOrEqual(path: string, ancestor: string): boolean {
  return path === ancestor || isPhotoInFolder(path, ancestor)
}

/**
 * Incrementally folds one photo into the accumulated folder counts/hierarchy,
 * bumping the recursive file count for every ancestor folder from rootPath
 * down to the photo's parent directory. `counts` and `childrenOf` are mutated
 * in place — callers own copy-on-write (see photoLibraryReducer's METADATA_BATCH),
 * so this stays O(depth) per photo instead of O(N) for the whole library.
 */
export function addPhotoToFolderTree(
  filePath: string,
  rootPath: string,
  counts: Map<string, number>,
  childrenOf: Map<string, Set<string>>
): void {
  const chain: string[] = []
  let dir = dirname(filePath)
  while (dir.length >= rootPath.length && dir.startsWith(rootPath)) {
    chain.push(dir)
    if (dir === rootPath) break
    dir = dirname(dir)
  }
  chain.reverse()

  for (const folder of chain) {
    counts.set(folder, (counts.get(folder) ?? 0) + 1)
    if (!childrenOf.has(folder)) childrenOf.set(folder, new Set())
  }
  for (let i = 0; i < chain.length - 1; i++) {
    childrenOf.get(chain[i])?.add(chain[i + 1])
  }
}

/**
 * Flattens the accumulated counts/hierarchy maps into a Mantine Tree data
 * structure. Cost is O(folders log folders), not O(photos) — folders are
 * typically far fewer than photos, so this stays cheap even for large scans.
 */
export function foldersToTreeData(
  rootPath: string,
  counts: Map<string, number>,
  childrenOf: Map<string, Set<string>>
): TreeNodeData {
  function build(folder: string): TreeNodeData {
    const kids = Array.from(childrenOf.get(folder) ?? [])
      .sort((a, b) => basename(a).localeCompare(basename(b)))
      .map(build)
    return {
      value: folder,
      label: basename(folder) || folder,
      nodeProps: { fileCount: counts.get(folder) ?? 0 },
      children: kids.length > 0 ? kids : undefined
    }
  }

  return build(rootPath)
}
