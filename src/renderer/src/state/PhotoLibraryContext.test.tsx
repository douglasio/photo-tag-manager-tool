import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { PhotoLibraryProvider, usePhotoLibrary } from './PhotoLibraryContext'
import type { PhotoRecord } from '../../../shared/types'

function makePhoto(filePath: string, overrides: Partial<PhotoRecord> = {}): PhotoRecord {
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
    thumbnailStatus: 'pending',
    thumbnailKey: null,
    scanError: null,
    fromCache: false,
    ...overrides
  }
}

// Captures every on*() subscription callback so tests can fire them
// manually to simulate main-process events, and stubs every request/response
// method with a resolved default a test can override via mockResolvedValue.
function createMockApi(): {
  subscriptions: Record<string, (payload: unknown) => void>
  api: Record<string, ReturnType<typeof vi.fn>>
} {
  const subscriptions: Record<string, (payload: unknown) => void> = {}
  const onMethod = (name: string): ReturnType<typeof vi.fn> =>
    vi.fn((callback: (payload: unknown) => void) => {
      subscriptions[name] = callback
      return vi.fn()
    })

  const api = {
    selectFolder: vi.fn().mockResolvedValue(null),
    getFolders: vi.fn().mockResolvedValue([]),
    showItemInFolder: vi.fn().mockResolvedValue(undefined),
    renamePhoto: vi.fn(),
    updateDateTaken: vi.fn(),
    updateComment: vi.fn(),
    rotatePhoto: vi.fn(),
    movePhotosToFolder: vi.fn(),
    onMoveProgress: onMethod('onMoveProgress'),
    getGalleryCellWidth: vi.fn().mockResolvedValue(null),
    setGalleryCellWidth: vi.fn().mockResolvedValue(undefined),
    getGallerySort: vi.fn().mockResolvedValue(null),
    setGallerySort: vi.fn().mockResolvedValue(undefined),
    getShowEmptyFolders: vi.fn().mockResolvedValue(false),
    setShowEmptyFolders: vi.fn().mockResolvedValue(undefined),
    getDetailsPanelCollapsed: vi.fn().mockResolvedValue(false),
    setDetailsPanelCollapsed: vi.fn().mockResolvedValue(undefined),
    getGalleryAnimationsEnabled: vi.fn().mockResolvedValue(true),
    setGalleryAnimationsEnabled: vi.fn().mockResolvedValue(undefined),
    getShowFilenames: vi.fn().mockResolvedValue(true),
    setShowFilenames: vi.fn().mockResolvedValue(undefined),
    getExcludePatterns: vi.fn().mockResolvedValue([]),
    setExcludePatterns: vi.fn().mockResolvedValue(undefined),
    addFolder: vi.fn().mockResolvedValue(undefined),
    removeFolder: vi.fn().mockResolvedValue(undefined),
    renameFolder: vi.fn(),
    startScan: vi.fn().mockResolvedValue({ scanId: 'scan-1' }),
    cancelScan: vi.fn().mockResolvedValue(undefined),
    updateTags: vi.fn(),
    getTagDescriptions: vi.fn().mockResolvedValue({}),
    setTagDescription: vi.fn().mockResolvedValue(undefined),
    renameTag: vi.fn(),
    deleteTag: vi.fn(),
    addTagsToPhotos: vi.fn(),
    onScanProgress: onMethod('onScanProgress'),
    onMetadataBatch: onMethod('onMetadataBatch'),
    onScanComplete: onMethod('onScanComplete'),
    onPhotoUpserted: onMethod('onPhotoUpserted'),
    onPhotoRemoved: onMethod('onPhotoRemoved'),
    onFolderAdded: onMethod('onFolderAdded'),
    onFolderRemoved: onMethod('onFolderRemoved')
  }

  return { subscriptions, api }
}

let mockApi: Record<string, ReturnType<typeof vi.fn>>
let subscriptions: Record<string, (payload: unknown) => void>

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return <PhotoLibraryProvider>{children}</PhotoLibraryProvider>
}

function setup(): ReturnType<typeof renderHook<ReturnType<typeof usePhotoLibrary>, unknown>> {
  return renderHook(() => usePhotoLibrary(), { wrapper })
}

describe('PhotoLibraryContext', () => {
  beforeEach(() => {
    const created = createMockApi()
    mockApi = created.api
    subscriptions = created.subscriptions
    vi.stubGlobal('window', Object.assign(window, { api: mockApi }))
  })

  it('hydrates settings from window.api on mount', async () => {
    mockApi.getShowEmptyFolders.mockResolvedValue(true)
    mockApi.getShowFilenames.mockResolvedValue(false)
    mockApi.getGalleryAnimationsEnabled.mockResolvedValue(false)
    mockApi.getDetailsPanelCollapsed.mockResolvedValue(true)
    mockApi.getExcludePatterns.mockResolvedValue(['.trash'])
    mockApi.getTagDescriptions.mockResolvedValue({ vacation: 'Beach trips' })

    const { result } = setup()

    await waitFor(() => expect(result.current.state.showEmptyFolders).toBe(true))
    expect(result.current.state.showFilenames).toBe(false)
    expect(result.current.state.galleryAnimationsEnabled).toBe(false)
    expect(result.current.state.detailsPanelCollapsed).toBe(true)
    expect(result.current.state.excludePatterns).toEqual(['.trash'])
    expect(result.current.state.tagDescriptions.get('vacation')).toBe('Beach trips')
  })

  it('scans every loaded folder on mount', async () => {
    mockApi.getFolders.mockResolvedValue(['/root'])
    const { result } = setup()

    await waitFor(() => expect(mockApi.startScan).toHaveBeenCalledWith('/root'))
    expect(result.current.state.folders).toEqual(['/root'])
  })

  it('flips initialLoadComplete only once every folder finishes its startup scan', async () => {
    mockApi.getFolders.mockResolvedValue(['/root'])
    const { result } = setup()

    await waitFor(() => expect(mockApi.startScan).toHaveBeenCalledWith('/root'))
    expect(result.current.state.initialLoadComplete).toBe(false)

    act(() => {
      subscriptions.onScanComplete({
        scanId: 'scan-1',
        rootPath: '/root',
        totalScanned: 0,
        cacheHits: 0,
        errors: [],
        allFolders: [],
        filePaths: []
      })
    })

    await waitFor(() => expect(result.current.state.initialLoadComplete).toBe(true))
  })

  it('sets initialLoadComplete immediately when there are no folders to scan', async () => {
    mockApi.getFolders.mockResolvedValue([])
    const { result } = setup()

    await waitFor(() => expect(result.current.state.initialLoadComplete).toBe(true))
  })

  describe('selection', () => {
    it('selectPhoto replaces both selectedPath and the multi-selection', () => {
      const { result } = setup()
      act(() => result.current.selectPhoto('/a.jpg'))
      expect(result.current.state.selectedPath).toBe('/a.jpg')
      expect(result.current.state.selectedPaths).toEqual(new Set(['/a.jpg']))
    })

    it('toggleSelectPhoto adds/removes from the multi-selection', () => {
      const { result } = setup()
      act(() => result.current.toggleSelectPhoto('/a.jpg'))
      expect(result.current.state.selectedPaths.has('/a.jpg')).toBe(true)
      act(() => result.current.toggleSelectPhoto('/a.jpg'))
      expect(result.current.state.selectedPaths.has('/a.jpg')).toBe(false)
    })

    it('clearSelection empties both', () => {
      const { result } = setup()
      act(() => result.current.selectPhoto('/a.jpg'))
      act(() => result.current.clearSelection())
      expect(result.current.state.selectedPath).toBeNull()
      expect(result.current.state.selectedPaths.size).toBe(0)
    })

    it('selectPhotoRange selects everything between the anchor and target in visible order', async () => {
      mockApi.getFolders.mockResolvedValue(['/root'])
      const { result } = setup()
      await waitFor(() => expect(mockApi.startScan).toHaveBeenCalled())

      act(() => {
        subscriptions.onMetadataBatch({
          scanId: 'scan-1',
          photos: [makePhoto('/root/a.jpg'), makePhoto('/root/b.jpg'), makePhoto('/root/c.jpg')]
        })
      })

      act(() => result.current.selectPhoto('/root/a.jpg'))
      act(() => result.current.selectPhotoRange('/root/c.jpg'))

      expect(result.current.state.selectedPaths).toEqual(
        new Set(['/root/a.jpg', '/root/b.jpg', '/root/c.jpg'])
      )
      expect(result.current.state.selectedPath).toBe('/root/c.jpg')
    })
  })

  describe('tabs', () => {
    it('opens, closes, and reorders photo tabs', () => {
      const { result } = setup()
      act(() => result.current.openPhotoTab('/a.jpg'))
      expect(result.current.state.openTabs).toEqual(['/a.jpg'])
      expect(result.current.state.activeTab).toBe('/a.jpg')

      act(() => result.current.openPhotoTab('/b.jpg'))
      act(() => result.current.reorderPhotoTabs(['/b.jpg', '/a.jpg']))
      expect(result.current.state.openTabs).toEqual(['/b.jpg', '/a.jpg'])

      act(() => result.current.closePhotoTab('/b.jpg'))
      expect(result.current.state.openTabs).toEqual(['/a.jpg'])
    })

    it('navigateToPhoto swaps a tab in place and records the direction/visualization for one-shot consumption', () => {
      const { result } = setup()
      act(() => result.current.openPhotoTab('/a.jpg'))
      act(() => result.current.navigateToPhoto('/a.jpg', '/b.jpg', 'right', 'magazine'))

      expect(result.current.state.openTabs).toEqual(['/b.jpg'])
      expect(result.current.state.activeTab).toBe('/b.jpg')
      expect(result.current.consumeNavDirection('/b.jpg')).toBe('right')
      // Consuming removes it — a second read gets null.
      expect(result.current.consumeNavDirection('/b.jpg')).toBeNull()
      expect(result.current.consumeVisualization('/b.jpg')).toBe('magazine')
      expect(result.current.consumeVisualization('/b.jpg')).toBeNull()
    })
  })

  describe('settings setters', () => {
    it('setShowFilenames dispatches and persists', () => {
      const { result } = setup()
      act(() => result.current.setShowFilenames(false))
      expect(result.current.state.showFilenames).toBe(false)
      expect(mockApi.setShowFilenames).toHaveBeenCalledWith(false)
    })

    it('setGalleryAnimationsEnabled dispatches and persists', () => {
      const { result } = setup()
      act(() => result.current.setGalleryAnimationsEnabled(false))
      expect(result.current.state.galleryAnimationsEnabled).toBe(false)
      expect(mockApi.setGalleryAnimationsEnabled).toHaveBeenCalledWith(false)
    })

    it('setDetailsPanelCollapsed dispatches and persists', () => {
      const { result } = setup()
      act(() => result.current.setDetailsPanelCollapsed(true))
      expect(result.current.state.detailsPanelCollapsed).toBe(true)
      expect(mockApi.setDetailsPanelCollapsed).toHaveBeenCalledWith(true)
    })

    it('setShowEmptyFolders dispatches and persists', () => {
      const { result } = setup()
      act(() => result.current.setShowEmptyFolders(true))
      expect(result.current.state.showEmptyFolders).toBe(true)
      expect(mockApi.setShowEmptyFolders).toHaveBeenCalledWith(true)
    })

    it('setSort dispatches and persists', () => {
      const { result } = setup()
      act(() => result.current.setSort('dateTaken', 'desc'))
      expect(result.current.state.sortBy).toBe('dateTaken')
      expect(mockApi.setGallerySort).toHaveBeenCalledWith({
        sortBy: 'dateTaken',
        sortOrder: 'desc'
      })
    })
  })

  describe('folder filters', () => {
    it('setFolderFilter clears the tag filter', () => {
      const { result } = setup()
      act(() => result.current.setTagFilter('vacation'))
      act(() => result.current.setFolderFilter('/root'))
      expect(result.current.state.selectedFolder).toBe('/root')
      expect(result.current.state.selectedTag).toBeNull()
    })

    it('setFolderTagFilter narrows within the folder without clearing it', () => {
      const { result } = setup()
      act(() => result.current.setFolderFilter('/root'))
      act(() => result.current.setFolderTagFilter('vacation'))
      expect(result.current.state.selectedFolder).toBe('/root')
      expect(result.current.state.selectedTag).toBe('vacation')
    })
  })

  describe('addFolder', () => {
    it('does nothing when the user cancels the folder picker', async () => {
      mockApi.selectFolder.mockResolvedValue(null)
      const { result } = setup()
      await act(() => result.current.addFolder())
      expect(mockApi.addFolder).not.toHaveBeenCalled()
      expect(result.current.state.folders).toEqual([])
    })

    it('adds and starts scanning the selected folder', async () => {
      mockApi.selectFolder.mockResolvedValue('/new-root')
      const { result } = setup()
      await act(() => result.current.addFolder())

      expect(mockApi.addFolder).toHaveBeenCalledWith('/new-root')
      expect(result.current.state.folders).toEqual(['/new-root'])
      expect(mockApi.startScan).toHaveBeenCalledWith('/new-root')
    })

    it('does not add the folder to state when the IPC call rejects', async () => {
      mockApi.selectFolder.mockResolvedValue('/new-root')
      mockApi.addFolder.mockRejectedValue(new Error('disk error'))
      const { result } = setup()

      await expect(act(() => result.current.addFolder())).rejects.toThrow('disk error')
      expect(result.current.state.folders).toEqual([])
    })
  })

  describe('derived data (photos/visiblePhotos/tags)', () => {
    async function seedPhotos(): Promise<ReturnType<typeof setup>> {
      mockApi.getFolders.mockResolvedValue(['/root'])
      const hook = setup()
      await waitFor(() => expect(mockApi.startScan).toHaveBeenCalled())
      act(() => {
        subscriptions.onMetadataBatch({
          scanId: 'scan-1',
          photos: [
            makePhoto('/root/b.jpg', { tags: ['beach'] }),
            makePhoto('/root/a.jpg', { tags: ['beach', 'sunset'] })
          ]
        })
      })
      return hook
    }

    it('sorts photos by filename by default', async () => {
      const { result } = await seedPhotos()
      expect(result.current.photos.map((p) => p.fileName)).toEqual(['a.jpg', 'b.jpg'])
    })

    it('computes tag counts and the alphabetized tag list', async () => {
      const { result } = await seedPhotos()
      expect(result.current.tagCounts.get('beach')).toBe(2)
      expect(result.current.tagCounts.get('sunset')).toBe(1)
      expect(result.current.allTags).toEqual(['beach', 'sunset'])
    })

    it('visiblePhotos narrows by the selected tag', async () => {
      const { result } = await seedPhotos()
      act(() => result.current.setTagFilter('sunset'))
      expect(result.current.visiblePhotos.map((p) => p.fileName)).toEqual(['a.jpg'])
    })
  })

  describe('tag/photo write operations', () => {
    it('addTagsToPhotos upserts photos and records recent tags', async () => {
      const updated = [makePhoto('/a.jpg', { tags: ['new-tag'] })]
      mockApi.addTagsToPhotos.mockResolvedValue(updated)
      const { result } = setup()

      await act(() => result.current.addTagsToPhotos(['new-tag'], ['/a.jpg']))

      expect(result.current.state.recentTags).toEqual(['new-tag'])
      expect(result.current.photos.find((p) => p.filePath === '/a.jpg')?.tags).toEqual(['new-tag'])
    })

    it('rotatePhoto upserts the returned photo', async () => {
      const rotated = makePhoto('/a.jpg')
      mockApi.rotatePhoto.mockResolvedValue(rotated)
      const { result } = setup()

      await act(() => result.current.rotatePhoto('/a.jpg', 'right'))
      expect(mockApi.rotatePhoto).toHaveBeenCalledWith('/a.jpg', 'right')
      expect(result.current.photos.some((p) => p.filePath === '/a.jpg')).toBe(true)
    })
  })
})
