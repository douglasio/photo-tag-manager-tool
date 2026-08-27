// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockHandle,
  mockGetFolders,
  mockSetFolders,
  mockPruneMissing,
  mockRenamePhotoPathPrefix,
  mockDeleteThumbnail,
  mockWatchFolder,
  mockUnwatchFolder,
  mockRename,
  mockStat
} = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockGetFolders: vi.fn().mockReturnValue([]),
  mockSetFolders: vi.fn(),
  mockPruneMissing: vi.fn().mockReturnValue([]),
  mockRenamePhotoPathPrefix: vi.fn(),
  mockDeleteThumbnail: vi.fn().mockResolvedValue(undefined),
  mockWatchFolder: vi.fn(),
  mockUnwatchFolder: vi.fn().mockResolvedValue(undefined),
  mockRename: vi.fn().mockResolvedValue(undefined),
  // Rejecting means "nothing at that path" — the handler treats a resolved
  // stat as a name collision.
  mockStat: vi.fn().mockRejectedValue(new Error('ENOENT'))
}))

vi.mock('electron', () => ({ ipcMain: { handle: mockHandle } }))
vi.mock('fs/promises', () => ({ rename: mockRename, stat: mockStat }))
vi.mock('@main/db/photoRepository', () => ({
  pruneMissing: mockPruneMissing,
  renamePhotoPathPrefix: mockRenamePhotoPathPrefix
}))
vi.mock('@main/db/settingsRepository', () => ({
  getFolders: mockGetFolders,
  setFolders: mockSetFolders
}))
vi.mock('@main/services/thumbnailService', () => ({ deleteThumbnail: mockDeleteThumbnail }))
vi.mock('@main/services/watchManager', () => ({
  watchFolder: mockWatchFolder,
  unwatchFolder: mockUnwatchFolder
}))

import { registerFolderHandlers } from './folderHandlers'

// Captures the ipcMain.handle(channel, fn) registrations so tests can invoke
// them directly, the same way the real preload -> ipcMain.invoke round trip would.
function getHandlers(): Map<string, (event: unknown, ...args: unknown[]) => unknown> {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
  mockHandle.mockImplementation((channel: string, fn: (...args: unknown[]) => unknown) => {
    handlers.set(channel, fn)
  })
  registerFolderHandlers()
  return handlers
}

function invoke(channel: string, ...args: unknown[]): unknown {
  const handler = getHandlers().get(channel)
  if (!handler) throw new Error(`No handler registered for ${channel}`)
  return handler({}, ...args)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetFolders.mockReturnValue([])
  mockPruneMissing.mockReturnValue([])
  mockStat.mockRejectedValue(new Error('ENOENT'))
  mockRename.mockResolvedValue(undefined)
})

describe('registration', () => {
  it('registers every folder channel the preload API invokes', () => {
    expect([...getHandlers().keys()]).toEqual([
      'settings:getFolders',
      'settings:addFolder',
      'settings:removeFolder',
      'settings:renameFolder'
    ])
  })
})

describe('settings:addFolder', () => {
  it('appends the folder and starts watching it', () => {
    mockGetFolders.mockReturnValue(['/photos/a'])

    invoke('settings:addFolder', '/photos/b')

    expect(mockSetFolders).toHaveBeenCalledWith(['/photos/a', '/photos/b'])
    expect(mockWatchFolder).toHaveBeenCalledWith('/photos/b')
  })

  it('does not duplicate an already-watched folder, but still re-watches it', () => {
    mockGetFolders.mockReturnValue(['/photos/a'])

    invoke('settings:addFolder', '/photos/a')

    expect(mockSetFolders).not.toHaveBeenCalled()
    expect(mockWatchFolder).toHaveBeenCalledWith('/photos/a')
  })
})

describe('settings:removeFolder', () => {
  it('drops the folder, unwatches it, and deletes the thumbnails it owned', async () => {
    mockGetFolders.mockReturnValue(['/photos/a', '/photos/b'])
    mockPruneMissing.mockReturnValue(['thumb-1', 'thumb-2'])

    await invoke('settings:removeFolder', '/photos/a')

    expect(mockSetFolders).toHaveBeenCalledWith(['/photos/b'])
    expect(mockUnwatchFolder).toHaveBeenCalledWith('/photos/a')
    // An empty "still present" set means every photo under the folder is
    // pruned, which is what returns the thumbnail keys to delete.
    expect(mockPruneMissing).toHaveBeenCalledWith('/photos/a', new Set())
    expect(mockDeleteThumbnail).toHaveBeenCalledWith('thumb-1')
    expect(mockDeleteThumbnail).toHaveBeenCalledWith('thumb-2')
  })
})

describe('settings:renameFolder', () => {
  it('renames a watched root: moves it on disk, rewrites paths, and updates the root list', async () => {
    mockGetFolders.mockReturnValue(['/photos/a'])

    const result = await invoke('settings:renameFolder', '/photos/a', 'archive')

    expect(result).toBe('/photos/archive')
    expect(mockRename).toHaveBeenCalledWith('/photos/a', '/photos/archive')
    expect(mockRenamePhotoPathPrefix).toHaveBeenCalledWith('/photos/a', '/photos/archive')
    expect(mockSetFolders).toHaveBeenCalledWith(['/photos/archive'])
    // The root's own watcher is detached for the rename and reattached at
    // the new path.
    expect(mockUnwatchFolder).toHaveBeenCalledWith('/photos/a')
    expect(mockWatchFolder).toHaveBeenCalledWith('/photos/archive')
  })

  it('renames a subfolder by detaching the watched ROOT, leaving the root list alone', async () => {
    mockGetFolders.mockReturnValue(['/photos/a'])

    const result = await invoke('settings:renameFolder', '/photos/a/trip', '2024-trip')

    expect(result).toBe('/photos/a/2024-trip')
    expect(mockRenamePhotoPathPrefix).toHaveBeenCalledWith('/photos/a/trip', '/photos/a/2024-trip')
    // chokidar watches recursively from the root, so it's the root that gets
    // cycled — and the root list itself is unchanged.
    expect(mockUnwatchFolder).toHaveBeenCalledWith('/photos/a')
    expect(mockWatchFolder).toHaveBeenCalledWith('/photos/a')
    expect(mockSetFolders).not.toHaveBeenCalled()
  })

  it('rejects an empty name without touching the filesystem', async () => {
    mockGetFolders.mockReturnValue(['/photos/a'])

    await expect(invoke('settings:renameFolder', '/photos/a', '   ')).rejects.toThrow(
      'Folder name cannot be empty'
    )
    expect(mockRename).not.toHaveBeenCalled()
    expect(mockUnwatchFolder).not.toHaveBeenCalled()
  })

  it.each(['a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b'])(
    'rejects the invalid folder name %j without touching the filesystem',
    async (name) => {
      mockGetFolders.mockReturnValue(['/photos/a'])

      await expect(invoke('settings:renameFolder', '/photos/a', name)).rejects.toThrow(
        'Folder name contains invalid characters'
      )
      expect(mockRename).not.toHaveBeenCalled()
    }
  )

  it('rejects a folder that belongs to no watched root', async () => {
    mockGetFolders.mockReturnValue(['/photos/a'])

    await expect(invoke('settings:renameFolder', '/elsewhere/b', 'new')).rejects.toThrow(
      'Folder not found'
    )
    expect(mockRename).not.toHaveBeenCalled()
  })

  it('does not treat a sibling with a shared prefix as being under the root', async () => {
    // '/photos/ab' starts with '/photos/a' as a string, but isn't inside it —
    // only a path separator makes it a real descendant.
    mockGetFolders.mockReturnValue(['/photos/a'])

    await expect(invoke('settings:renameFolder', '/photos/ab', 'new')).rejects.toThrow(
      'Folder not found'
    )
  })

  it('refuses to overwrite an existing folder', async () => {
    mockGetFolders.mockReturnValue(['/photos/a'])
    mockStat.mockResolvedValue({ isDirectory: () => true })

    await expect(invoke('settings:renameFolder', '/photos/a', 'taken')).rejects.toThrow(
      'A folder with that name already exists'
    )
    expect(mockRename).not.toHaveBeenCalled()
    // Bailing out before unwatching matters: the watcher must survive a
    // rename that never happened.
    expect(mockUnwatchFolder).not.toHaveBeenCalled()
  })

  it('is a no-op when the name is unchanged, leaving the watcher attached', async () => {
    mockGetFolders.mockReturnValue(['/photos/a'])

    const result = await invoke('settings:renameFolder', '/photos/a', 'a')

    expect(result).toBe('/photos/a')
    expect(mockRename).not.toHaveBeenCalled()
    expect(mockUnwatchFolder).not.toHaveBeenCalled()
    expect(mockSetFolders).not.toHaveBeenCalled()
  })

  it('trims surrounding whitespace from the new name', async () => {
    mockGetFolders.mockReturnValue(['/photos/a'])

    const result = await invoke('settings:renameFolder', '/photos/a', '  archive  ')

    expect(result).toBe('/photos/archive')
    expect(mockRename).toHaveBeenCalledWith('/photos/a', '/photos/archive')
  })
})
