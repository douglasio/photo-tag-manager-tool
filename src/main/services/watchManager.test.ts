// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

const {
  mockStartWatching,
  mockStopWatching,
  mockStopAllWatchers,
  mockIngestFile,
  mockDeleteThumbnail,
  mockRemovePhoto,
  mockGetExcludePatterns,
  mockReconcileTagGroups,
  mockKickIndexer
} = vi.hoisted(() => ({
  mockStartWatching: vi.fn(),
  mockStopWatching: vi.fn().mockResolvedValue(undefined),
  mockStopAllWatchers: vi.fn().mockResolvedValue(undefined),
  mockIngestFile: vi.fn(),
  mockDeleteThumbnail: vi.fn().mockResolvedValue(undefined),
  mockRemovePhoto: vi.fn(),
  mockGetExcludePatterns: vi.fn().mockReturnValue([]),
  mockReconcileTagGroups: vi.fn(),
  mockKickIndexer: vi.fn()
}))

vi.mock('./embeddingIndexService', () => ({ kickIndexer: mockKickIndexer }))
vi.mock('./folderWatcher', () => ({
  startWatching: mockStartWatching,
  stopWatching: mockStopWatching,
  stopAllWatchers: mockStopAllWatchers
}))
vi.mock('./photoIngest', () => ({ ingestFile: mockIngestFile }))
vi.mock('./thumbnailService', () => ({ deleteThumbnail: mockDeleteThumbnail }))
vi.mock('../db/photoRepository', () => ({ removePhoto: mockRemovePhoto }))
vi.mock('../db/settingsRepository', () => ({ getExcludePatterns: mockGetExcludePatterns }))
vi.mock('../db/tagMetadataRepository', () => ({ reconcileTagGroups: mockReconcileTagGroups }))

import {
  restartAllWatchers,
  setWatchTarget,
  suppressNextEvent,
  unwatchAllFolders,
  unwatchFolder,
  watchFolder
} from './watchManager'

function makePhoto(filePath: string): PhotoRecord {
  return {
    id: filePath,
    filePath,
    fileName: filePath.split('/').pop() ?? filePath,
    tags: [],
    metadata: {
      dateTaken: null,
      cameraMake: null,
      cameraModel: null,
      widthPx: null,
      heightPx: null,
      fileSizeBytes: 0,
      format: 'JPEG',
      comment: null
    },
    thumbnailStatus: 'ready',
    thumbnailKey: 'key',
    scanError: null,
    fromCache: false,
    viewCount: 0
  }
}

describe('watchManager', () => {
  let send: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetExcludePatterns.mockReturnValue([])
    send = vi.fn()
    setWatchTarget({ send, isDestroyed: () => false } as never)
  })

  it('watchFolder registers file/dir handlers with the current exclude patterns', () => {
    mockGetExcludePatterns.mockReturnValue(['.trash'])
    watchFolder('/root')
    expect(mockStartWatching).toHaveBeenCalledWith(
      '/root',
      expect.objectContaining({
        onFileEvent: expect.any(Function),
        onDirEvent: expect.any(Function)
      }),
      ['.trash']
    )
  })

  describe('onFileEvent', () => {
    function getHandlers(): {
      onFileEvent: (type: 'add' | 'change' | 'unlink', filePath: string) => void
      onDirEvent: (type: 'addDir' | 'unlinkDir', dirPath: string) => void
    } {
      watchFolder('/root')
      return mockStartWatching.mock.calls[0][1]
    }

    it('ingests and sends watch:photo-upserted for an add/change event', async () => {
      mockIngestFile.mockResolvedValue({ photo: makePhoto('/root/a.jpg'), fromCache: false })
      const { onFileEvent } = getHandlers()

      onFileEvent('add', '/root/a.jpg')
      await vi.waitFor(() => expect(send).toHaveBeenCalled())

      expect(send).toHaveBeenCalledWith('watch:photo-upserted', {
        photo: expect.objectContaining({ filePath: '/root/a.jpg' }),
        changeType: 'add'
      })
      // A newly-ready photo needs embedding for visual search.
      expect(mockKickIndexer).toHaveBeenCalled()
    })

    it('removes the photo and its thumbnail for an unlink event', async () => {
      mockRemovePhoto.mockReturnValue('thumb-key')
      const { onFileEvent } = getHandlers()

      onFileEvent('unlink', '/root/a.jpg')
      await vi.waitFor(() => expect(send).toHaveBeenCalled())

      expect(mockDeleteThumbnail).toHaveBeenCalledWith('thumb-key')
      expect(send).toHaveBeenCalledWith('watch:photo-removed', { filePath: '/root/a.jpg' })
    })

    it('skips deleteThumbnail when the removed photo had no thumbnail', async () => {
      mockRemovePhoto.mockReturnValue(null)
      const { onFileEvent } = getHandlers()

      onFileEvent('unlink', '/root/a.jpg')
      await vi.waitFor(() => expect(send).toHaveBeenCalled())
      expect(mockDeleteThumbnail).not.toHaveBeenCalled()
    })

    it('suppresses exactly the next event for a path flagged via suppressNextEvent', async () => {
      const { onFileEvent } = getHandlers()
      suppressNextEvent('/root/a.jpg')

      onFileEvent('change', '/root/a.jpg')
      expect(mockIngestFile).not.toHaveBeenCalled()

      // The suppression is one-shot — a second event for the same path goes
      // through normally.
      mockIngestFile.mockResolvedValue({ photo: makePhoto('/root/a.jpg'), fromCache: false })
      onFileEvent('change', '/root/a.jpg')
      await vi.waitFor(() => expect(mockIngestFile).toHaveBeenCalled())
    })

    it('logs and does not throw when ingestion fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockIngestFile.mockRejectedValue(new Error('boom'))
      const { onFileEvent } = getHandlers()

      onFileEvent('add', '/root/a.jpg')
      await vi.waitFor(() => expect(consoleError).toHaveBeenCalled())
      expect(send).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })

  describe('onDirEvent', () => {
    it('sends watch:folder-added for addDir', () => {
      watchFolder('/root')
      const { onDirEvent } = mockStartWatching.mock.calls[0][1]
      onDirEvent('addDir', '/root/new')
      expect(send).toHaveBeenCalledWith('watch:folder-added', { folderPath: '/root/new' })
    })

    it('sends watch:folder-removed for unlinkDir', () => {
      watchFolder('/root')
      const { onDirEvent } = mockStartWatching.mock.calls[0][1]
      onDirEvent('unlinkDir', '/root/gone')
      expect(send).toHaveBeenCalledWith('watch:folder-removed', { folderPath: '/root/gone' })
    })
  })

  it('restartAllWatchers stops every folder then starts them again', async () => {
    await restartAllWatchers(['/root/a', '/root/b'])
    expect(mockStopWatching).toHaveBeenCalledWith('/root/a')
    expect(mockStopWatching).toHaveBeenCalledWith('/root/b')
    expect(mockStartWatching).toHaveBeenCalledTimes(2)
  })

  it('unwatchFolder and unwatchAllFolders delegate to folderWatcher', async () => {
    await unwatchFolder('/root')
    expect(mockStopWatching).toHaveBeenCalledWith('/root')
    await unwatchAllFolders()
    expect(mockStopAllWatchers).toHaveBeenCalled()
  })
})
