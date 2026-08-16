import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

import { PhotoLibraryProvider, usePhotoLibrary } from './PhotoLibraryContext'

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
    viewCount: 0,
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
    incrementPhotoView: vi.fn(),
    movePhotosToFolder: vi.fn(),
    onMoveProgress: onMethod('onMoveProgress'),
    deletePhotos: vi.fn().mockResolvedValue([]),
    dismissDuplicateGroup: vi.fn().mockResolvedValue(undefined),
    getGalleryCellWidth: vi.fn().mockResolvedValue(null),
    setGalleryCellWidth: vi.fn().mockResolvedValue(undefined),
    getGallerySort: vi.fn().mockResolvedValue(null),
    setGallerySort: vi.fn().mockResolvedValue(undefined),
    getDefaultView: vi.fn().mockResolvedValue('gallery'),
    setDefaultView: vi.fn().mockResolvedValue(undefined),
    getShowEmptyFolders: vi.fn().mockResolvedValue(false),
    setShowEmptyFolders: vi.fn().mockResolvedValue(undefined),
    getTagsPanelGridView: vi.fn().mockResolvedValue(false),
    getPeoplePanelGridView: vi.fn().mockResolvedValue(false),
    setPeoplePanelGridView: vi.fn().mockResolvedValue(undefined),
    setTagsPanelGridView: vi.fn().mockResolvedValue(undefined),
    getGalleryViewMode: vi.fn().mockResolvedValue('grid'),
    setGalleryViewMode: vi.fn().mockResolvedValue(undefined),
    getAiTagSuggestionsEnabled: vi.fn().mockResolvedValue(false),
    setAiTagSuggestionsEnabled: vi.fn().mockResolvedValue(undefined),
    enableAiFeaturesAndScan: vi.fn().mockResolvedValue({
      duplicateGroups: [],
      photosScanned: 0,
      canceled: false
    }),
    rescanAiFeatures: vi.fn().mockResolvedValue({
      duplicateGroups: [],
      photosScanned: 0,
      canceled: false
    }),
    cancelAiScan: vi.fn().mockResolvedValue(undefined),
    wasAiScanInterrupted: vi.fn().mockResolvedValue(false),
    onAiScanProgress: onMethod('onAiScanProgress'),
    suggestTags: vi.fn().mockResolvedValue([]),
    getFaceDetectionEnabled: vi.fn().mockResolvedValue(false),
    setFaceDetectionEnabled: vi.fn().mockResolvedValue(undefined),
    getFacesForPhoto: vi.fn().mockResolvedValue([]),
    getPeople: vi.fn().mockResolvedValue([]),
    getFacePhotoAssignments: vi.fn().mockResolvedValue([]),
    enableFaceDetectionAndScan: vi.fn().mockResolvedValue({
      facesDetected: 0,
      peopleCount: 0,
      photosScanned: 0,
      canceled: false
    }),
    rescanFaces: vi.fn().mockResolvedValue({
      facesDetected: 0,
      peopleCount: 0,
      photosScanned: 0,
      canceled: false
    }),
    cancelFaceScan: vi.fn().mockResolvedValue(undefined),
    onFaceScanProgress: onMethod('onFaceScanProgress'),
    renamePerson: vi.fn().mockResolvedValue(undefined),
    assignFaceToPerson: vi.fn().mockResolvedValue(undefined),
    splitFaceAsNewPerson: vi
      .fn()
      .mockResolvedValue({ id: 'person-new', name: null, coverFaceId: null, faceCount: 1 }),
    unassignFace: vi.fn().mockResolvedValue(undefined),
    mergePeople: vi.fn().mockResolvedValue(undefined),
    deletePerson: vi.fn().mockResolvedValue(undefined),
    setPersonDescription: vi.fn().mockResolvedValue(undefined),
    hidePerson: vi.fn().mockResolvedValue(undefined),
    unhidePerson: vi.fn().mockResolvedValue(undefined),
    getHiddenPeople: vi.fn().mockResolvedValue([]),
    getDetailsPanelCollapsed: vi.fn().mockResolvedValue(false),
    setDetailsPanelCollapsed: vi.fn().mockResolvedValue(undefined),
    getNavbarSplitSizes: vi.fn().mockResolvedValue(null),
    getNavbarCollapsedPanels: vi.fn().mockResolvedValue({}),
    setNavbarCollapsedPanels: vi.fn().mockResolvedValue(undefined),
    setNavbarSplitSizes: vi.fn().mockResolvedValue(undefined),
    getGalleryAnimationsEnabled: vi.fn().mockResolvedValue(true),
    setGalleryAnimationsEnabled: vi.fn().mockResolvedValue(undefined),
    getShowFilenames: vi.fn().mockResolvedValue(true),
    setShowFilenames: vi.fn().mockResolvedValue(undefined),
    getShowViewCounts: vi.fn().mockResolvedValue(false),
    setShowViewCounts: vi.fn().mockResolvedValue(undefined),
    getMagazineTitle: vi.fn().mockResolvedValue('TAG ME'),
    setMagazineTitle: vi.fn().mockResolvedValue(undefined),
    getNewspaperTitle: vi.fn().mockResolvedValue('The Tag Me Times'),
    setNewspaperTitle: vi.fn().mockResolvedValue(undefined),
    getDvdStudioName: vi.fn().mockResolvedValue('TAG ME PICTURES'),
    setDvdStudioName: vi.fn().mockResolvedValue(undefined),
    getArtGalleryName: vi.fn().mockResolvedValue('The Tag Me Gallery'),
    setArtGalleryName: vi.fn().mockResolvedValue(undefined),
    getExcludePatterns: vi.fn().mockResolvedValue([]),
    setExcludePatterns: vi.fn().mockResolvedValue(undefined),
    getExcludedFolders: vi.fn().mockResolvedValue([]),
    setExcludedFolders: vi.fn().mockResolvedValue(undefined),
    addFolder: vi.fn().mockResolvedValue(undefined),
    removeFolder: vi.fn().mockResolvedValue(undefined),
    renameFolder: vi.fn(),
    startScan: vi.fn().mockResolvedValue({ scanId: 'scan-1' }),
    startScanAll: vi.fn().mockResolvedValue({ scanId: 'scan-1' }),
    cancelScan: vi.fn().mockResolvedValue(undefined),
    updateTags: vi.fn(),
    getTagDescriptions: vi.fn().mockResolvedValue({}),
    setTagDescription: vi.fn().mockResolvedValue(undefined),
    renameTag: vi.fn(),
    deleteTag: vi.fn(),
    addTagsToPhotos: vi.fn(),
    removeTagsFromPhotos: vi.fn(),
    getTagGroupsData: vi.fn().mockResolvedValue({ groups: [], assignments: {} }),
    createTagGroup: vi.fn(),
    renameTagGroup: vi.fn(),
    setTagGroupMatchPattern: vi.fn(),
    deleteTagGroup: vi.fn(),
    setTagGroupAssignment: vi.fn(),
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
    mockApi.getExcludedFolders.mockResolvedValue(['/root/test'])
    mockApi.getTagDescriptions.mockResolvedValue({ vacation: 'Beach trips' })
    mockApi.getMagazineTitle.mockResolvedValue('Custom Mag')
    mockApi.getNewspaperTitle.mockResolvedValue('Custom Paper')
    mockApi.getDvdStudioName.mockResolvedValue('Custom Studio')

    const { result } = setup()

    await waitFor(() => expect(result.current.state.showEmptyFolders).toBe(true))
    expect(result.current.state.showFilenames).toBe(false)
    expect(result.current.state.galleryAnimationsEnabled).toBe(false)
    expect(result.current.state.detailsPanelCollapsed).toBe(true)
    expect(result.current.state.excludePatterns).toEqual(['.trash'])
    await waitFor(() => expect(result.current.state.excludedFolders).toEqual(['/root/test']))
    expect(result.current.state.tagDescriptions.get('vacation')).toBe('Beach trips')
    await waitFor(() => expect(result.current.state.magazineTitle).toBe('Custom Mag'))
    expect(result.current.state.newspaperTitle).toBe('Custom Paper')
    expect(result.current.state.dvdStudioName).toBe('Custom Studio')
  })

  it('scans every loaded folder on mount', async () => {
    mockApi.getFolders.mockResolvedValue(['/root'])
    const { result } = setup()

    await waitFor(() => expect(mockApi.startScanAll).toHaveBeenCalledWith(['/root']))
    expect(result.current.state.folders).toEqual(['/root'])
  })

  it('flips initialLoadComplete as soon as folders are known, without waiting for the startup scan', async () => {
    mockApi.getFolders.mockResolvedValue(['/root'])
    const { result } = setup()

    await waitFor(() => expect(result.current.state.initialLoadComplete).toBe(true))
    expect(mockApi.startScanAll).toHaveBeenCalledWith(['/root'])
  })

  it('sets initialLoadComplete immediately when there are no folders to scan', async () => {
    mockApi.getFolders.mockResolvedValue([])
    const { result } = setup()

    await waitFor(() => expect(result.current.state.initialLoadComplete).toBe(true))
  })

  describe('AI scan resume-on-launch', () => {
    it('silently resumes a scan left in progress by a prior quit', async () => {
      mockApi.wasAiScanInterrupted.mockResolvedValue(true)
      setup()

      await waitFor(() => expect(mockApi.rescanAiFeatures).toHaveBeenCalled())
    })

    it('does not rescan when no scan was left in progress', async () => {
      mockApi.wasAiScanInterrupted.mockResolvedValue(false)
      setup()

      await waitFor(() => expect(mockApi.wasAiScanInterrupted).toHaveBeenCalled())
      expect(mockApi.rescanAiFeatures).not.toHaveBeenCalled()
    })
  })

  describe('enableAiFeatures', () => {
    it('does not enable aiTagSuggestionsEnabled until progress reaches the embedding phase', async () => {
      mockApi.enableAiFeaturesAndScan.mockReturnValue(new Promise(() => undefined))
      const { result } = setup()

      act(() => {
        void result.current.enableAiFeatures()
      })
      expect(result.current.state.aiTagSuggestionsEnabled).toBe(false)

      act(() => {
        subscriptions.onAiScanProgress({ phase: 'embedding', done: 0, total: 1 })
      })

      await waitFor(() => expect(result.current.state.aiTagSuggestionsEnabled).toBe(true))
    })

    it('leaves aiTagSuggestionsEnabled false when the download is canceled before scanning starts', async () => {
      mockApi.enableAiFeaturesAndScan.mockResolvedValue({
        duplicateGroups: [],
        photosScanned: 0,
        canceled: true
      })
      const { result } = setup()

      await act(async () => {
        await result.current.enableAiFeatures()
      })

      expect(result.current.state.aiTagSuggestionsEnabled).toBe(false)
    })
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
      await waitFor(() => expect(mockApi.startScanAll).toHaveBeenCalled())

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

    it('setShowViewCounts dispatches and persists', () => {
      const { result } = setup()
      act(() => result.current.setShowViewCounts(true))
      expect(result.current.state.showViewCounts).toBe(true)
      expect(mockApi.setShowViewCounts).toHaveBeenCalledWith(true)
    })

    it('setMagazineTitle dispatches and persists', () => {
      const { result } = setup()
      act(() => result.current.setMagazineTitle('Custom Mag'))
      expect(result.current.state.magazineTitle).toBe('Custom Mag')
      expect(mockApi.setMagazineTitle).toHaveBeenCalledWith('Custom Mag')
    })

    it('setNewspaperTitle dispatches and persists', () => {
      const { result } = setup()
      act(() => result.current.setNewspaperTitle('Custom Paper'))
      expect(result.current.state.newspaperTitle).toBe('Custom Paper')
      expect(mockApi.setNewspaperTitle).toHaveBeenCalledWith('Custom Paper')
    })

    it('setDvdStudioName dispatches and persists', () => {
      const { result } = setup()
      act(() => result.current.setDvdStudioName('Custom Studio'))
      expect(result.current.state.dvdStudioName).toBe('Custom Studio')
      expect(mockApi.setDvdStudioName).toHaveBeenCalledWith('Custom Studio')
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

    it('setTagsPanelGridView dispatches and persists', () => {
      const { result } = setup()
      act(() => result.current.setTagsPanelGridView(true))
      expect(result.current.state.tagsPanelGridView).toBe(true)
      expect(mockApi.setTagsPanelGridView).toHaveBeenCalledWith(true)
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

    it('setFolderUntaggedFilter narrows within the folder without clearing it', () => {
      const { result } = setup()
      act(() => result.current.setFolderFilter('/root'))
      act(() => result.current.setFolderUntaggedFilter(true))
      expect(result.current.state.selectedFolder).toBe('/root')
      expect(result.current.state.untaggedFilterActive).toBe(true)
    })

    it('setFolderUntaggedFilter clears any active tag filter', () => {
      const { result } = setup()
      act(() => result.current.setFolderFilter('/root'))
      act(() => result.current.setFolderTagFilter('vacation'))
      act(() => result.current.setFolderUntaggedFilter(true))
      expect(result.current.state.selectedTag).toBeNull()
    })
  })

  describe('folder pill row (folderTags/folderHasUntagged)', () => {
    async function seedMixedFolder(): Promise<ReturnType<typeof setup>> {
      mockApi.getFolders.mockResolvedValue(['/root'])
      const hook = setup()
      await waitFor(() => expect(mockApi.startScanAll).toHaveBeenCalled())
      act(() => {
        subscriptions.onMetadataBatch({
          scanId: 'scan-1',
          photos: [
            makePhoto('/root/a.jpg', { tags: ['vacation'] }),
            makePhoto('/root/b.jpg', { tags: [] })
          ]
        })
      })
      return hook
    }

    it('reports folderHasUntagged when the folder has at least one untagged photo', async () => {
      const { result } = await seedMixedFolder()
      act(() => result.current.setFolderFilter('/root'))
      expect(result.current.folderHasUntagged).toBe(true)
      expect(result.current.folderTags).toEqual(['vacation'])
    })

    it("narrows visiblePhotos to the folder's untagged photos only", async () => {
      const { result } = await seedMixedFolder()
      act(() => result.current.setFolderFilter('/root'))
      act(() => result.current.setFolderUntaggedFilter(true))
      expect(result.current.visiblePhotos.map((p) => p.filePath)).toEqual(['/root/b.jpg'])
    })
  })

  describe('excluded folders', () => {
    async function seedExcludableLibrary(): Promise<ReturnType<typeof setup>> {
      mockApi.getFolders.mockResolvedValue(['/root'])
      const hook = setup()
      await waitFor(() => expect(mockApi.startScanAll).toHaveBeenCalled())
      act(() => {
        subscriptions.onMetadataBatch({
          scanId: 'scan-1',
          photos: [
            makePhoto('/root/a.jpg', { tags: ['beach'], viewCount: 2 }),
            makePhoto('/root/test/b.jpg', { tags: ['beach', 'private'], viewCount: 5 })
          ]
        })
      })
      return hook
    }

    it('excludeFolder dispatches and persists the folder', async () => {
      const { result } = setup()
      // Waits for the mount-time hydration effects (which dispatch their own
      // default SET_EXCLUDED_FOLDERS: []) to settle first — otherwise a
      // hydration dispatch landing after excludeFolder's would stomp it back.
      await waitFor(() => expect(result.current.state.initialLoadComplete).toBe(true))
      await act(() => result.current.excludeFolder('/root/test'))

      expect(result.current.state.excludedFolders).toEqual(['/root/test'])
      expect(mockApi.setExcludedFolders).toHaveBeenCalledWith(['/root/test'])
    })

    it('includeFolder removes a previously excluded folder', async () => {
      const { result } = setup()
      await waitFor(() => expect(result.current.state.initialLoadComplete).toBe(true))
      await act(() => result.current.excludeFolder('/root/test'))
      await act(() => result.current.includeFolder('/root/test'))

      expect(result.current.state.excludedFolders).toEqual([])
      expect(mockApi.setExcludedFolders).toHaveBeenLastCalledWith([])
    })

    it('excludes photos under an excluded folder from tagCounts/activePhotosByPath', async () => {
      const { result } = await seedExcludableLibrary()
      await act(() => result.current.excludeFolder('/root/test'))

      expect(result.current.activePhotosByPath.has('/root/test/b.jpg')).toBe(false)
      expect(result.current.activePhotosByPath.has('/root/a.jpg')).toBe(true)
      expect(result.current.tagCounts.get('beach')).toBe(1)
      expect(result.current.tagCounts.get('private')).toBeUndefined()
    })

    it('excludes photos from visiblePhotos in All Photos mode', async () => {
      const { result } = await seedExcludableLibrary()
      await act(() => result.current.excludeFolder('/root/test'))

      expect(result.current.visiblePhotos.map((p) => p.filePath)).toEqual(['/root/a.jpg'])
    })

    it("still shows the excluded folder's own photos when browsing directly into it", async () => {
      const { result } = await seedExcludableLibrary()
      await act(() => result.current.excludeFolder('/root/test'))
      act(() => result.current.setFolderFilter('/root/test'))

      expect(result.current.visiblePhotos.map((p) => p.filePath)).toEqual(['/root/test/b.jpg'])
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
      await waitFor(() => expect(mockApi.startScanAll).toHaveBeenCalled())
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

    it('sums view counts per tag across all its photos', async () => {
      mockApi.getFolders.mockResolvedValue(['/root'])
      const { result } = setup()
      await waitFor(() => expect(mockApi.startScanAll).toHaveBeenCalled())
      act(() => {
        subscriptions.onMetadataBatch({
          scanId: 'scan-1',
          photos: [
            makePhoto('/root/b.jpg', { tags: ['beach'], viewCount: 3 }),
            makePhoto('/root/a.jpg', { tags: ['beach', 'sunset'], viewCount: 5 })
          ]
        })
      })
      expect(result.current.tagViewCounts.get('beach')).toBe(8)
      expect(result.current.tagViewCounts.get('sunset')).toBe(5)
    })

    it('visiblePhotos narrows by the selected tag', async () => {
      const { result } = await seedPhotos()
      act(() => result.current.setTagFilter('sunset'))
      expect(result.current.visiblePhotos.map((p) => p.fileName)).toEqual(['a.jpg'])
    })

    it('sorts photos by view count, falling back to filename on ties', async () => {
      mockApi.getFolders.mockResolvedValue(['/root'])
      const { result } = setup()
      await waitFor(() => expect(mockApi.startScanAll).toHaveBeenCalled())
      act(() => {
        subscriptions.onMetadataBatch({
          scanId: 'scan-1',
          photos: [
            makePhoto('/root/b.jpg', { viewCount: 5 }),
            makePhoto('/root/a.jpg', { viewCount: 5 }),
            makePhoto('/root/c.jpg', { viewCount: 1 })
          ]
        })
      })

      act(() => result.current.setSort('viewCount', 'desc'))
      expect(result.current.photos.map((p) => p.fileName)).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])

      act(() => result.current.setSort('viewCount', 'asc'))
      expect(result.current.photos.map((p) => p.fileName)).toEqual(['c.jpg', 'a.jpg', 'b.jpg'])
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

    it('removeTagsFromPhotos upserts photos without touching tag metadata', async () => {
      const updated = [makePhoto('/a.jpg', { tags: [] })]
      mockApi.removeTagsFromPhotos.mockResolvedValue(updated)
      const { result } = setup()

      await act(() => result.current.removeTagsFromPhotos(['old-tag'], ['/a.jpg']))

      expect(mockApi.removeTagsFromPhotos).toHaveBeenCalledWith(['old-tag'], ['/a.jpg'])
      expect(result.current.photos.find((p) => p.filePath === '/a.jpg')?.tags).toEqual([])
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

  describe('deletePhotos', () => {
    async function seedTwoPhotos(): Promise<ReturnType<typeof setup>> {
      mockApi.getFolders.mockResolvedValue(['/root'])
      const hook = setup()
      await waitFor(() => expect(mockApi.startScanAll).toHaveBeenCalled())
      act(() => {
        subscriptions.onMetadataBatch({
          scanId: 'scan-1',
          photos: [makePhoto('/root/a.jpg'), makePhoto('/root/b.jpg')]
        })
      })
      return hook
    }

    it('removes every deleted photo from state', async () => {
      mockApi.deletePhotos.mockResolvedValue(['/root/a.jpg', '/root/b.jpg'])
      const { result } = await seedTwoPhotos()

      await act(() => result.current.deletePhotos(['/root/a.jpg', '/root/b.jpg']))

      expect(mockApi.deletePhotos).toHaveBeenCalledWith(['/root/a.jpg', '/root/b.jpg'])
      expect(result.current.photos).toEqual([])
    })

    it('only removes the paths the main process actually deleted', async () => {
      mockApi.deletePhotos.mockResolvedValue(['/root/a.jpg'])
      const { result } = await seedTwoPhotos()

      await act(() => result.current.deletePhotos(['/root/a.jpg', '/root/b.jpg']))

      expect(result.current.photos.map((p) => p.filePath)).toEqual(['/root/b.jpg'])
    })

    it('does nothing for an empty selection', async () => {
      const { result } = setup()
      await act(() => result.current.deletePhotos([]))
      expect(mockApi.deletePhotos).not.toHaveBeenCalled()
    })
  })

  describe('dismissDuplicateGroup', () => {
    it('persists the dismissal via window.api', async () => {
      const { result } = setup()
      await act(() => result.current.dismissDuplicateGroup(['/root/a.jpg', '/root/b.jpg']))
      expect(mockApi.dismissDuplicateGroup).toHaveBeenCalledWith(['/root/a.jpg', '/root/b.jpg'])
    })
  })
})
