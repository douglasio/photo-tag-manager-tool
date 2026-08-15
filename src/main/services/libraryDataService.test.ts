// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetDb,
  mockCloseDb,
  mockGetDbPath,
  mockDisposeDuplicateClusterWorker,
  mockDisposeTagSuggestionWorker,
  mockDisposeThrowbackSimilarityWorker,
  mockDeleteAllThumbnails,
  mockUnwatchAllFolders,
  mockAppRelaunch,
  mockAppExit,
  mockAppGetPath,
  mockReleaseSingleInstanceLock,
  mockCopyFile,
  mockRm,
  databaseConstructor
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockCloseDb: vi.fn(),
  mockGetDbPath: vi.fn().mockReturnValue('/userData/photag.db'),
  mockDisposeDuplicateClusterWorker: vi.fn().mockResolvedValue(undefined),
  mockDisposeTagSuggestionWorker: vi.fn().mockResolvedValue(undefined),
  mockDisposeThrowbackSimilarityWorker: vi.fn().mockResolvedValue(undefined),
  mockDeleteAllThumbnails: vi.fn().mockResolvedValue(undefined),
  mockUnwatchAllFolders: vi.fn().mockResolvedValue(undefined),
  mockAppRelaunch: vi.fn(),
  mockAppExit: vi.fn(),
  mockAppGetPath: vi.fn().mockReturnValue('/userData'),
  mockReleaseSingleInstanceLock: vi.fn(),
  mockCopyFile: vi.fn().mockResolvedValue(undefined),
  mockRm: vi.fn().mockResolvedValue(undefined),
  databaseConstructor: vi.fn()
}))

vi.mock('@main/db/database', () => ({
  getDb: mockGetDb,
  closeDb: mockCloseDb,
  getDbPath: mockGetDbPath
}))
vi.mock('./duplicatePhotoService', () => ({
  disposeDuplicateClusterWorker: mockDisposeDuplicateClusterWorker
}))
vi.mock('./tagSuggestionService', () => ({
  disposeTagSuggestionWorker: mockDisposeTagSuggestionWorker
}))
vi.mock('./throwbackService', () => ({
  disposeThrowbackSimilarityWorker: mockDisposeThrowbackSimilarityWorker
}))
vi.mock('./thumbnailService', () => ({ deleteAllThumbnails: mockDeleteAllThumbnails }))
vi.mock('./watchManager', () => ({ unwatchAllFolders: mockUnwatchAllFolders }))
vi.mock('electron', () => ({
  app: {
    relaunch: mockAppRelaunch,
    exit: mockAppExit,
    getPath: mockAppGetPath,
    releaseSingleInstanceLock: mockReleaseSingleInstanceLock
  }
}))
vi.mock('fs/promises', () => ({ copyFile: mockCopyFile, rm: mockRm }))
vi.mock('better-sqlite3', () => ({ default: databaseConstructor }))

import {
  clearLibrary,
  exportDatabase,
  importDatabase,
  validateDatabaseFile
} from './libraryDataService'

describe('exportDatabase', () => {
  it('backs up the live database to the destination path', async () => {
    const backup = vi.fn().mockResolvedValue(undefined)
    mockGetDb.mockReturnValue({ backup })

    await exportDatabase('/backups/mine.db')

    expect(backup).toHaveBeenCalledExactlyOnceWith('/backups/mine.db')
  })
})

describe('validateDatabaseFile', () => {
  it('returns true when the file has a photos table', () => {
    const close = vi.fn()
    const get = vi.fn().mockReturnValue({ 1: 1 })
    databaseConstructor.mockImplementation(function (this: unknown) {
      return { prepare: () => ({ get }), close }
    })

    expect(validateDatabaseFile('/picked/library.db')).toBe(true)
    expect(close).toHaveBeenCalledOnce()
  })

  it('returns false when the file opens but has no photos table', () => {
    const close = vi.fn()
    const get = vi.fn().mockReturnValue(undefined)
    databaseConstructor.mockImplementation(function (this: unknown) {
      return { prepare: () => ({ get }), close }
    })

    expect(validateDatabaseFile('/picked/not-ours.db')).toBe(false)
    expect(close).toHaveBeenCalledOnce()
  })

  it('returns false when the file cannot be opened as a database at all', () => {
    databaseConstructor.mockImplementation(function (this: unknown) {
      throw new Error('file is not a database')
    })

    expect(validateDatabaseFile('/picked/not-sqlite.txt')).toBe(false)
  })
})

describe('importDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDbPath.mockReturnValue('/userData/photag.db')
    mockAppGetPath.mockReturnValue('/userData')
  })

  it('shuts everything down, replaces the db file, and relaunches', async () => {
    const callOrder: string[] = []
    mockUnwatchAllFolders.mockImplementation(async () => {
      callOrder.push('unwatch')
    })
    mockDisposeTagSuggestionWorker.mockImplementation(async () => {
      callOrder.push('disposeTagSuggestion')
    })
    mockCloseDb.mockImplementation(() => {
      callOrder.push('closeDb')
    })
    mockCopyFile.mockImplementation(async () => {
      callOrder.push('copyFile')
    })
    mockAppRelaunch.mockImplementation(() => {
      callOrder.push('relaunch')
    })
    mockReleaseSingleInstanceLock.mockImplementation(() => {
      callOrder.push('releaseLock')
    })

    await importDatabase('/picked/backup.db')

    expect(callOrder.indexOf('unwatch')).toBeLessThan(callOrder.indexOf('closeDb'))
    expect(callOrder.indexOf('disposeTagSuggestion')).toBeLessThan(callOrder.indexOf('closeDb'))
    expect(callOrder.indexOf('closeDb')).toBeLessThan(callOrder.indexOf('copyFile'))
    expect(callOrder.indexOf('copyFile')).toBeLessThan(callOrder.indexOf('relaunch'))
    // Releasing the lock before relaunching avoids a race where the newly
    // spawned process's own lock request loses to this process's not-yet-
    // released one, silently skipping window/handler setup.
    expect(callOrder.indexOf('releaseLock')).toBeLessThan(callOrder.indexOf('relaunch'))
    expect(mockCopyFile).toHaveBeenCalledWith('/picked/backup.db', '/userData/photag.db')
    expect(mockRm).toHaveBeenCalledWith('/userData/photag.db-wal', { force: true })
    expect(mockRm).toHaveBeenCalledWith('/userData/photag.db-shm', { force: true })
    expect(mockAppExit).toHaveBeenCalledWith(0)
  })
})

describe('clearLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDbPath.mockReturnValue('/userData/photag.db')
    mockAppGetPath.mockReturnValue('/userData')
  })

  it('shuts everything down, wipes the db/thumbnails/ai-models, and relaunches', async () => {
    await clearLibrary()

    expect(mockUnwatchAllFolders).toHaveBeenCalled()
    expect(mockDisposeTagSuggestionWorker).toHaveBeenCalled()
    expect(mockDisposeDuplicateClusterWorker).toHaveBeenCalled()
    expect(mockDisposeThrowbackSimilarityWorker).toHaveBeenCalled()
    expect(mockCloseDb).toHaveBeenCalled()
    expect(mockRm).toHaveBeenCalledWith('/userData/photag.db', { force: true })
    expect(mockRm).toHaveBeenCalledWith('/userData/photag.db-wal', { force: true })
    expect(mockRm).toHaveBeenCalledWith('/userData/photag.db-shm', { force: true })
    expect(mockDeleteAllThumbnails).toHaveBeenCalled()
    expect(mockRm).toHaveBeenCalledWith(expect.stringContaining('ai-models'), {
      recursive: true,
      force: true
    })
    expect(mockReleaseSingleInstanceLock).toHaveBeenCalled()
    expect(mockAppRelaunch).toHaveBeenCalled()
    expect(mockAppExit).toHaveBeenCalledWith(0)
  })
})
