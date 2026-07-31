import { describe, expect, it } from 'vitest'

import {
  addPhotoToFolderTree,
  basename,
  findRootFolder,
  foldersToTreeData,
  foldersToTreeDataWithEmpty,
  isPathUnderOrEqual,
  isPhotoInFolder,
  removePhotoFromFolderTree,
  rewritePathPrefix
} from './folderTree'

describe('basename', () => {
  it('returns the last path segment', () => {
    expect(basename('/root/sub/a.jpg')).toBe('a.jpg')
  })

  it('returns the input unchanged when there is no separator', () => {
    expect(basename('a.jpg')).toBe('a.jpg')
  })
})

describe('isPhotoInFolder', () => {
  it('is true for a direct child path', () => {
    expect(isPhotoInFolder('/root/a.jpg', '/root')).toBe(true)
  })

  it('is false for the folder itself', () => {
    expect(isPhotoInFolder('/root', '/root')).toBe(false)
  })

  it('is false for a sibling folder with a matching prefix', () => {
    expect(isPhotoInFolder('/root-other/a.jpg', '/root')).toBe(false)
  })
})

describe('isPathUnderOrEqual', () => {
  it('is true for the ancestor itself', () => {
    expect(isPathUnderOrEqual('/root', '/root')).toBe(true)
  })

  it('is true for a nested descendant', () => {
    expect(isPathUnderOrEqual('/root/sub/a.jpg', '/root')).toBe(true)
  })

  it('is false for an unrelated path', () => {
    expect(isPathUnderOrEqual('/other/a.jpg', '/root')).toBe(false)
  })
})

describe('rewritePathPrefix', () => {
  it('rewrites the folder itself', () => {
    expect(rewritePathPrefix('/root/old', '/root/old', '/root/new')).toBe('/root/new')
  })

  it('rewrites a nested path, preserving the suffix', () => {
    expect(rewritePathPrefix('/root/old/a.jpg', '/root/old', '/root/new')).toBe('/root/new/a.jpg')
  })

  it('leaves an unrelated path unchanged', () => {
    expect(rewritePathPrefix('/other/a.jpg', '/root/old', '/root/new')).toBe('/other/a.jpg')
  })
})

describe('findRootFolder', () => {
  it('finds the matching root folder', () => {
    expect(findRootFolder('/root/a.jpg', ['/root', '/other'])).toBe('/root')
  })

  it('picks the most specific (deepest) matching root', () => {
    expect(findRootFolder('/root/sub/a.jpg', ['/root', '/root/sub'])).toBe('/root/sub')
  })

  it('returns null when nothing matches', () => {
    expect(findRootFolder('/nowhere/a.jpg', ['/root'])).toBeNull()
  })
})

describe('addPhotoToFolderTree / removePhotoFromFolderTree', () => {
  it('increments counts for every ancestor folder down to root', () => {
    const counts = new Map<string, number>()
    const childrenOf = new Map<string, Set<string>>()
    addPhotoToFolderTree('/root/sub/a.jpg', '/root', counts, childrenOf)

    expect(counts.get('/root')).toBe(1)
    expect(counts.get('/root/sub')).toBe(1)
    expect(childrenOf.get('/root')).toEqual(new Set(['/root/sub']))
  })

  it('accumulates counts across multiple photos in the same folder', () => {
    const counts = new Map<string, number>()
    const childrenOf = new Map<string, Set<string>>()
    addPhotoToFolderTree('/root/a.jpg', '/root', counts, childrenOf)
    addPhotoToFolderTree('/root/b.jpg', '/root', counts, childrenOf)
    expect(counts.get('/root')).toBe(2)
  })

  it('removePhotoFromFolderTree is the exact inverse of add', () => {
    const counts = new Map<string, number>()
    const childrenOf = new Map<string, Set<string>>()
    addPhotoToFolderTree('/root/sub/a.jpg', '/root', counts, childrenOf)
    removePhotoFromFolderTree('/root/sub/a.jpg', '/root', counts, childrenOf)

    expect(counts.size).toBe(0)
    expect(childrenOf.size).toBe(0)
  })

  it('removing one of several photos only decrements, not deletes', () => {
    const counts = new Map<string, number>()
    const childrenOf = new Map<string, Set<string>>()
    addPhotoToFolderTree('/root/a.jpg', '/root', counts, childrenOf)
    addPhotoToFolderTree('/root/b.jpg', '/root', counts, childrenOf)
    removePhotoFromFolderTree('/root/a.jpg', '/root', counts, childrenOf)

    expect(counts.get('/root')).toBe(1)
  })
})

describe('foldersToTreeData', () => {
  it('builds a nested tree sorted by basename', () => {
    const counts = new Map([
      ['/root', 2],
      ['/root/b', 1],
      ['/root/a', 1]
    ])
    const childrenOf = new Map([['/root', new Set(['/root/b', '/root/a'])]])

    const tree = foldersToTreeData('/root', counts, childrenOf)

    expect(tree.value).toBe('/root')
    expect(tree.nodeProps).toEqual({ fileCount: 2 })
    expect(tree.children?.map((c) => c.value)).toEqual(['/root/a', '/root/b'])
  })

  it('leaves children undefined for a leaf folder', () => {
    const tree = foldersToTreeData('/root', new Map([['/root', 0]]), new Map())
    expect(tree.children).toBeUndefined()
  })
})

describe('foldersToTreeDataWithEmpty', () => {
  it('includes folders with zero photos', () => {
    const allFolderPaths = new Set(['/root', '/root/empty'])
    const tree = foldersToTreeDataWithEmpty('/root', allFolderPaths, new Map())

    expect(tree.children?.map((c) => c.value)).toEqual(['/root/empty'])
    expect(tree.children?.[0].nodeProps).toEqual({ fileCount: 0 })
  })
})
