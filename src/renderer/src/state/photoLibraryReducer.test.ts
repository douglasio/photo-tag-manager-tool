import { describe, expect, it } from 'vitest'
import {
  initialState,
  photoLibraryReducer,
  RECENT_TAGS_LIMIT,
  type PhotoLibraryState
} from './photoLibraryReducer'
import type { PhotoRecord, ScanCompleteEvent } from '../../../shared/types'

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

function withPhotos(...paths: string[]): PhotoLibraryState {
  let state = { ...initialState, folders: ['/root'] }
  state = photoLibraryReducer(state, {
    type: 'METADATA_BATCH',
    photos: paths.map((p) => makePhoto(p))
  })
  return state
}

describe('photoLibraryReducer', () => {
  describe('folder management', () => {
    it('adds a new folder', () => {
      const state = photoLibraryReducer(initialState, { type: 'FOLDER_ADDED', folder: '/root' })
      expect(state.folders).toEqual(['/root'])
    })

    it('does not add a duplicate folder', () => {
      const once = photoLibraryReducer(initialState, { type: 'FOLDER_ADDED', folder: '/root' })
      const twice = photoLibraryReducer(once, { type: 'FOLDER_ADDED', folder: '/root' })
      expect(twice).toBe(once)
    })

    it('removes a folder and everything nested under it', () => {
      let state = withPhotos('/root/a.jpg', '/root/sub/b.jpg')
      state = photoLibraryReducer(state, { type: 'SELECT_PHOTO', path: '/root/a.jpg' })
      state = photoLibraryReducer(state, { type: 'OPEN_PHOTO_TAB', filePath: '/root/a.jpg' })

      const removed = photoLibraryReducer(state, { type: 'FOLDER_REMOVED', folder: '/root' })

      expect(removed.folders).toEqual([])
      expect(removed.photosByPath.size).toBe(0)
      expect(removed.selectedPath).toBeNull()
      expect(removed.openTabs).toEqual([])
      expect(removed.activeTab).toBe('gallery')
    })

    it('rewrites every path-shaped bit of state on folder rename', () => {
      let state = withPhotos('/root/old/a.jpg')
      state = photoLibraryReducer(state, { type: 'SELECT_PHOTO', path: '/root/old/a.jpg' })
      state = photoLibraryReducer(state, { type: 'OPEN_PHOTO_TAB', filePath: '/root/old/a.jpg' })
      state = photoLibraryReducer(state, { type: 'SET_FOLDER_FILTER', folder: '/root/old' })

      const renamed = photoLibraryReducer(state, {
        type: 'FOLDER_RENAMED',
        oldFolder: '/root/old',
        newFolder: '/root/new'
      })

      expect(renamed.photosByPath.has('/root/new/a.jpg')).toBe(true)
      expect(renamed.photosByPath.has('/root/old/a.jpg')).toBe(false)
      expect(renamed.selectedPath).toBe('/root/new/a.jpg')
      expect(renamed.selectedFolder).toBe('/root/new')
      expect(renamed.openTabs).toEqual(['/root/new/a.jpg'])
      expect(renamed.activeTab).toBe('/root/new/a.jpg')
    })
  })

  describe('scanning', () => {
    it('tracks scan lifecycle', () => {
      let state = photoLibraryReducer(initialState, {
        type: 'SCAN_STARTED',
        rootPath: '/root',
        scanId: 'scan-1'
      })
      expect(state.status).toBe('scanning')

      state = photoLibraryReducer(state, { type: 'SCAN_PROGRESS', filesFound: 5 })
      expect(state.filesFound).toBe(5)

      state = photoLibraryReducer(state, { type: 'SCAN_CANCELED' })
      expect(state.status).toBe('canceled')
    })

    it('returns the same state reference for a no-op progress update', () => {
      const state = { ...initialState, filesFound: 5 }
      const next = photoLibraryReducer(state, { type: 'SCAN_PROGRESS', filesFound: 5 })
      expect(next).toBe(state)
    })

    it('prunes photos missing from a completed scan result', () => {
      let state = { ...initialState, folders: ['/root'] }
      state = photoLibraryReducer(state, {
        type: 'METADATA_BATCH',
        photos: [makePhoto('/root/a.jpg'), makePhoto('/root/b.jpg')]
      })
      state = photoLibraryReducer(state, { type: 'SELECT_PHOTO', path: '/root/b.jpg' })

      const result: ScanCompleteEvent = {
        scanId: 'scan-1',
        rootPath: '/root',
        totalScanned: 1,
        cacheHits: 0,
        errors: [],
        allFolders: ['/root'],
        filePaths: ['/root/a.jpg']
      }
      const next = photoLibraryReducer(state, { type: 'SCAN_COMPLETE', result })

      expect(next.photosByPath.has('/root/b.jpg')).toBe(false)
      expect(next.photosByPath.has('/root/a.jpg')).toBe(true)
      expect(next.selectedPath).toBeNull()
      expect(next.status).toBe('complete')
    })

    it('only adds folders (does not prune) when filePaths is null', () => {
      let state = { ...initialState, folders: ['/root'] }
      state = photoLibraryReducer(state, {
        type: 'METADATA_BATCH',
        photos: [makePhoto('/root/a.jpg')]
      })
      const result: ScanCompleteEvent = {
        scanId: 'scan-1',
        rootPath: '/root',
        totalScanned: 0,
        cacheHits: 0,
        errors: [],
        allFolders: ['/root/new-empty'],
        filePaths: null
      }
      const next = photoLibraryReducer(state, { type: 'SCAN_COMPLETE', result })
      expect(next.photosByPath.has('/root/a.jpg')).toBe(true)
      expect(next.allFolderPaths.has('/root/new-empty')).toBe(true)
    })
  })

  describe('selection', () => {
    it('selects and clears a single photo', () => {
      const selected = photoLibraryReducer(initialState, { type: 'SELECT_PHOTO', path: '/a.jpg' })
      expect(selected.selectedPath).toBe('/a.jpg')
      const cleared = photoLibraryReducer(selected, { type: 'SELECT_PHOTO', path: null })
      expect(cleared.selectedPath).toBeNull()
    })

    it('replaces the multi-selection set', () => {
      const state = photoLibraryReducer(initialState, {
        type: 'SET_SELECTED_PATHS',
        paths: ['/a.jpg', '/b.jpg']
      })
      expect(state.selectedPaths).toEqual(new Set(['/a.jpg', '/b.jpg']))
    })

    it('setting folder filter clears tag filter and vice versa', () => {
      let state = photoLibraryReducer(initialState, { type: 'SET_TAG_FILTER', tag: 'vacation' })
      expect(state.selectedFolder).toBeNull()

      state = photoLibraryReducer(state, { type: 'SET_FOLDER_FILTER', folder: '/root' })
      expect(state.selectedTag).toBeNull()
      expect(state.selectedFolder).toBe('/root')
    })

    it('folder-scoped tag filter keeps the folder selection intact', () => {
      let state = photoLibraryReducer(initialState, { type: 'SET_FOLDER_FILTER', folder: '/root' })
      state = photoLibraryReducer(state, { type: 'SET_FOLDER_TAG_FILTER', tag: 'vacation' })
      expect(state.selectedFolder).toBe('/root')
      expect(state.selectedTag).toBe('vacation')
    })
  })

  describe('settings toggles', () => {
    it.each([
      ['SET_SHOW_EMPTY_FOLDERS', 'showEmptyFolders'],
      ['SET_DETAILS_PANEL_COLLAPSED', 'detailsPanelCollapsed'],
      ['SET_GALLERY_ANIMATIONS_ENABLED', 'galleryAnimationsEnabled'],
      ['SET_SHOW_FILENAMES', 'showFilenames']
    ] as const)('%s flips %s', (type, key) => {
      const state = photoLibraryReducer(initialState, { type, value: true } as never)
      expect(state[key]).toBe(true)
      const flipped = photoLibraryReducer(state, { type, value: false } as never)
      expect(flipped[key]).toBe(false)
    })

    it('sets the sort order', () => {
      const state = photoLibraryReducer(initialState, {
        type: 'SET_SORT',
        sortBy: 'dateTaken',
        sortOrder: 'desc'
      })
      expect(state.sortBy).toBe('dateTaken')
      expect(state.sortOrder).toBe('desc')
    })

    it('replaces exclude patterns', () => {
      const state = photoLibraryReducer(initialState, {
        type: 'SET_EXCLUDE_PATTERNS',
        patterns: ['.trash']
      })
      expect(state.excludePatterns).toEqual(['.trash'])
    })
  })

  describe('recent tags', () => {
    it('is a no-op for an empty tag list', () => {
      const next = photoLibraryReducer(initialState, { type: 'TAGS_ASSIGNED', tags: [] })
      expect(next).toBe(initialState)
    })

    it('adds newly-assigned tags to the front, deduped', () => {
      let state = photoLibraryReducer(initialState, { type: 'TAGS_ASSIGNED', tags: ['a', 'b'] })
      expect(state.recentTags).toEqual(['a', 'b'])

      state = photoLibraryReducer(state, { type: 'TAGS_ASSIGNED', tags: ['b', 'c'] })
      expect(state.recentTags).toEqual(['b', 'c', 'a'])
    })

    it('caps the list at RECENT_TAGS_LIMIT', () => {
      let state = initialState
      for (const tag of ['a', 'b', 'c', 'd']) {
        state = photoLibraryReducer(state, { type: 'TAGS_ASSIGNED', tags: [tag] })
      }
      expect(state.recentTags).toHaveLength(RECENT_TAGS_LIMIT)
      expect(state.recentTags).toEqual(['d', 'c', 'b'])
    })
  })

  describe('watched folders', () => {
    it('adds a discovered folder once', () => {
      const once = photoLibraryReducer(initialState, {
        type: 'WATCH_FOLDER_ADDED',
        folderPath: '/root/new'
      })
      expect(once.allFolderPaths.has('/root/new')).toBe(true)
      const twice = photoLibraryReducer(once, {
        type: 'WATCH_FOLDER_ADDED',
        folderPath: '/root/new'
      })
      expect(twice).toBe(once)
    })

    it('removes a folder and its nested subtree', () => {
      let state = photoLibraryReducer(initialState, {
        type: 'WATCH_FOLDER_ADDED',
        folderPath: '/root'
      })
      state = photoLibraryReducer(state, {
        type: 'WATCH_FOLDER_ADDED',
        folderPath: '/root/sub'
      })
      const next = photoLibraryReducer(state, {
        type: 'WATCH_FOLDER_REMOVED',
        folderPath: '/root'
      })
      expect(next.allFolderPaths.size).toBe(0)
    })
  })

  describe('individual photo upserts/removal', () => {
    it('upserts a new photo under its matching root folder', () => {
      const state = { ...initialState, folders: ['/root'] }
      const next = photoLibraryReducer(state, {
        type: 'PHOTO_UPSERTED',
        photo: makePhoto('/root/a.jpg')
      })
      expect(next.photosByPath.has('/root/a.jpg')).toBe(true)
      expect(next.folderCounts.get('/root')).toBe(1)
    })

    it('removes a photo, clearing selection/tabs that referenced it', () => {
      let state = withPhotos('/root/a.jpg')
      state = photoLibraryReducer(state, { type: 'SELECT_PHOTO', path: '/root/a.jpg' })
      state = photoLibraryReducer(state, { type: 'OPEN_PHOTO_TAB', filePath: '/root/a.jpg' })

      const next = photoLibraryReducer(state, { type: 'PHOTO_REMOVED', filePath: '/root/a.jpg' })
      expect(next.photosByPath.has('/root/a.jpg')).toBe(false)
      expect(next.selectedPath).toBeNull()
      expect(next.openTabs).toEqual([])
      expect(next.activeTab).toBe('gallery')
    })

    it('removing an unknown photo is a no-op', () => {
      const next = photoLibraryReducer(initialState, {
        type: 'PHOTO_REMOVED',
        filePath: '/nope.jpg'
      })
      expect(next).toBe(initialState)
    })
  })

  describe('tag descriptions, rename, delete', () => {
    it('loads and updates tag descriptions', () => {
      let state = photoLibraryReducer(initialState, {
        type: 'TAG_DESCRIPTIONS_LOADED',
        descriptions: { vacation: 'Beach trips' }
      })
      expect(state.tagDescriptions.get('vacation')).toBe('Beach trips')

      state = photoLibraryReducer(state, {
        type: 'TAG_DESCRIPTION_UPDATED',
        tag: 'vacation',
        description: 'Updated'
      })
      expect(state.tagDescriptions.get('vacation')).toBe('Updated')

      state = photoLibraryReducer(state, {
        type: 'TAG_DESCRIPTION_UPDATED',
        tag: 'vacation',
        description: '   '
      })
      expect(state.tagDescriptions.has('vacation')).toBe(false)
    })

    it('renames a tag, moving its description and updating affected photos', () => {
      let state = withPhotos('/root/a.jpg')
      state = photoLibraryReducer(state, {
        type: 'TAG_DESCRIPTIONS_LOADED',
        descriptions: { old: 'desc' }
      })
      state = photoLibraryReducer(state, { type: 'SET_TAG_FILTER', tag: 'old' })

      const renamedPhoto = makePhoto('/root/a.jpg', { tags: ['new'] })
      const next = photoLibraryReducer(state, {
        type: 'TAG_RENAMED',
        oldTag: 'old',
        newTag: 'new',
        photos: [renamedPhoto]
      })

      expect(next.photosByPath.get('/root/a.jpg')?.tags).toEqual(['new'])
      expect(next.tagDescriptions.has('old')).toBe(false)
      expect(next.tagDescriptions.get('new')).toBe('desc')
      expect(next.selectedTag).toBe('new')
    })

    it('deletes a tag, clearing the selected filter if it matched', () => {
      let state = withPhotos('/root/a.jpg')
      state = photoLibraryReducer(state, {
        type: 'TAG_DESCRIPTIONS_LOADED',
        descriptions: { old: 'desc' }
      })
      state = photoLibraryReducer(state, { type: 'SET_TAG_FILTER', tag: 'old' })

      const next = photoLibraryReducer(state, {
        type: 'TAG_DELETED',
        tag: 'old',
        photos: [makePhoto('/root/a.jpg', { tags: [] })]
      })
      expect(next.tagDescriptions.has('old')).toBe(false)
      expect(next.selectedTag).toBeNull()
    })
  })

  describe('photo view tabs', () => {
    it('opens a new tab and makes it active', () => {
      const state = photoLibraryReducer(initialState, {
        type: 'OPEN_PHOTO_TAB',
        filePath: '/a.jpg'
      })
      expect(state.openTabs).toEqual(['/a.jpg'])
      expect(state.activeTab).toBe('/a.jpg')
    })

    it('opening an already-open tab does not duplicate it', () => {
      let state = photoLibraryReducer(initialState, { type: 'OPEN_PHOTO_TAB', filePath: '/a.jpg' })
      state = photoLibraryReducer(state, { type: 'OPEN_PHOTO_TAB', filePath: '/a.jpg' })
      expect(state.openTabs).toEqual(['/a.jpg'])
    })

    it('closing the active tab falls back to its left neighbor', () => {
      let state = photoLibraryReducer(initialState, { type: 'OPEN_PHOTO_TAB', filePath: '/a.jpg' })
      state = photoLibraryReducer(state, { type: 'OPEN_PHOTO_TAB', filePath: '/b.jpg' })
      state = photoLibraryReducer(state, { type: 'SET_ACTIVE_TAB', tab: '/b.jpg' })

      const next = photoLibraryReducer(state, { type: 'CLOSE_PHOTO_TAB', filePath: '/b.jpg' })
      expect(next.openTabs).toEqual(['/a.jpg'])
      expect(next.activeTab).toBe('/a.jpg')
    })

    it('closing the leftmost photo tab falls back to gallery', () => {
      let state = photoLibraryReducer(initialState, { type: 'OPEN_PHOTO_TAB', filePath: '/a.jpg' })
      state = photoLibraryReducer(state, { type: 'SET_ACTIVE_TAB', tab: '/a.jpg' })

      const next = photoLibraryReducer(state, { type: 'CLOSE_PHOTO_TAB', filePath: '/a.jpg' })
      expect(next.openTabs).toEqual([])
      expect(next.activeTab).toBe('gallery')
    })

    it('closing a tab that is not active leaves activeTab untouched', () => {
      let state = photoLibraryReducer(initialState, { type: 'OPEN_PHOTO_TAB', filePath: '/a.jpg' })
      state = photoLibraryReducer(state, { type: 'OPEN_PHOTO_TAB', filePath: '/b.jpg' })
      state = photoLibraryReducer(state, { type: 'SET_ACTIVE_TAB', tab: '/a.jpg' })

      const next = photoLibraryReducer(state, { type: 'CLOSE_PHOTO_TAB', filePath: '/b.jpg' })
      expect(next.activeTab).toBe('/a.jpg')
    })

    it('closing an unopened tab is a no-op', () => {
      const next = photoLibraryReducer(initialState, {
        type: 'CLOSE_PHOTO_TAB',
        filePath: '/nope.jpg'
      })
      expect(next).toBe(initialState)
    })

    it('renames an open tab in place, including the active pointer', () => {
      const state = photoLibraryReducer(initialState, {
        type: 'OPEN_PHOTO_TAB',
        filePath: '/a.jpg'
      })
      const next = photoLibraryReducer(state, {
        type: 'RENAME_PHOTO_TAB',
        oldPath: '/a.jpg',
        newPath: '/a-renamed.jpg'
      })
      expect(next.openTabs).toEqual(['/a-renamed.jpg'])
      expect(next.activeTab).toBe('/a-renamed.jpg')
    })

    it('drops the other occurrence when newPath is already open in a different tab', () => {
      // Reproduces the "stacked tabs" bug: arrow-key navigation (which
      // dispatches this same action) stepping onto a photo the user already
      // has open elsewhere used to leave two tabs pointing at the same path.
      let state = photoLibraryReducer(initialState, { type: 'OPEN_PHOTO_TAB', filePath: '/a.jpg' })
      state = photoLibraryReducer(state, { type: 'OPEN_PHOTO_TAB', filePath: '/b.jpg' })
      state = photoLibraryReducer(state, { type: 'SET_ACTIVE_TAB', tab: '/a.jpg' })

      const next = photoLibraryReducer(state, {
        type: 'RENAME_PHOTO_TAB',
        oldPath: '/a.jpg',
        newPath: '/b.jpg'
      })

      expect(next.openTabs).toEqual(['/b.jpg'])
      expect(next.activeTab).toBe('/b.jpg')
    })

    it('collision-dedup keeps the correct active tab when the pre-existing duplicate was active', () => {
      let state = photoLibraryReducer(initialState, { type: 'OPEN_PHOTO_TAB', filePath: '/a.jpg' })
      state = photoLibraryReducer(state, { type: 'OPEN_PHOTO_TAB', filePath: '/b.jpg' })
      // /b.jpg (opened second) is active; /a.jpg gets renamed onto it from a
      // background tab (e.g. another tab's own arrow-key step).
      const next = photoLibraryReducer(state, {
        type: 'RENAME_PHOTO_TAB',
        oldPath: '/a.jpg',
        newPath: '/b.jpg'
      })
      expect(next.openTabs).toEqual(['/b.jpg'])
      expect(next.activeTab).toBe('/b.jpg')
    })

    it('renaming an unopened tab is a no-op', () => {
      const next = photoLibraryReducer(initialState, {
        type: 'RENAME_PHOTO_TAB',
        oldPath: '/nope.jpg',
        newPath: '/still-nope.jpg'
      })
      expect(next).toBe(initialState)
    })

    it('reorders open tabs', () => {
      let state = photoLibraryReducer(initialState, { type: 'OPEN_PHOTO_TAB', filePath: '/a.jpg' })
      state = photoLibraryReducer(state, { type: 'OPEN_PHOTO_TAB', filePath: '/b.jpg' })
      const next = photoLibraryReducer(state, {
        type: 'REORDER_PHOTO_TABS',
        openTabs: ['/b.jpg', '/a.jpg']
      })
      expect(next.openTabs).toEqual(['/b.jpg', '/a.jpg'])
    })
  })

  it('returns the same state for an unknown action type', () => {
    const next = photoLibraryReducer(initialState, { type: 'NOT_REAL' } as never)
    expect(next).toBe(initialState)
  })
})
