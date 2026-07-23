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

/** Mirror image of addPhotoToFolderTree, for when a watched file is deleted or moves out of scope. */
export function removePhotoFromFolderTree(
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
    const next = (counts.get(folder) ?? 0) - 1
    if (next > 0) {
      counts.set(folder, next)
    } else {
      counts.delete(folder)
      childrenOf.delete(folder)
    }
  }
  for (let i = 0; i < chain.length - 1; i++) {
    if (!counts.has(chain[i + 1])) {
      childrenOf.get(chain[i])?.delete(chain[i + 1])
    }
  }
}

/** Rewrites path if it's oldFolder itself or nested under it, substituting
 * oldFolder for newFolder; otherwise returns path unchanged. Used to sweep
 * every path-shaped piece of state (folders, Map keys, selection, tabs...)
 * after a folder rename. */
export function rewritePathPrefix(path: string, oldFolder: string, newFolder: string): string {
  if (path === oldFolder) return newFolder
  if (isPhotoInFolder(path, oldFolder)) return newFolder + path.slice(oldFolder.length)
  return path
}

/** Finds which watched root folder (if any) a file path falls under. */
export function findRootFolder(filePath: string, folders: string[]): string | null {
  let best: string | null = null
  for (const folder of folders) {
    if (isPathUnderOrEqual(filePath, folder) && (best === null || folder.length > best.length)) {
      best = folder
    }
  }
  return best
}

function buildTreeNode(
  folder: string,
  childrenOf: Map<string, Set<string>>,
  counts: Map<string, number>
): TreeNodeData {
  const kids = Array.from(childrenOf.get(folder) ?? [])
    .sort((a, b) => basename(a).localeCompare(basename(b)))
    .map((child) => buildTreeNode(child, childrenOf, counts))
  return {
    value: folder,
    label: basename(folder) || folder,
    nodeProps: { fileCount: counts.get(folder) ?? 0 },
    children: kids.length > 0 ? kids : undefined
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
  return buildTreeNode(rootPath, childrenOf, counts)
}

/**
 * Same output shape as foldersToTreeData, but built from the full on-disk
 * folder listing (allFolderPaths, captured separately at scan time) rather
 * than photo-derived childrenOf — so folders with zero photos in them are
 * included too. Used when the "show empty folders" setting is on.
 */
export function foldersToTreeDataWithEmpty(
  rootPath: string,
  allFolderPaths: Set<string>,
  counts: Map<string, number>
): TreeNodeData {
  const childrenOf = new Map<string, Set<string>>()
  for (const folder of allFolderPaths) {
    if (!childrenOf.has(folder)) childrenOf.set(folder, new Set())
  }
  if (!childrenOf.has(rootPath)) childrenOf.set(rootPath, new Set())

  for (const folder of allFolderPaths) {
    if (folder === rootPath) continue
    const parent = dirname(folder)
    childrenOf.get(parent)?.add(folder)
  }

  return buildTreeNode(rootPath, childrenOf, counts)
}
