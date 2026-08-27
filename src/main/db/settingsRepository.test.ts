// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }))
vi.mock('./database', () => ({ getDb: mockGetDb }))

import * as settings from './settingsRepository'

// Mimics just enough of better-sqlite3's prepare().get()/.run() to exercise
// settingsRepository's two SQL shapes (SELECT by key, upsert by key) against
// a real in-memory Map, without depending on an actual SQLite file.
function createFakeDb(): { store: Map<string, string> } {
  const store = new Map<string, string>()
  mockGetDb.mockReturnValue({
    prepare: (sql: string) => {
      if (sql.trim().startsWith('SELECT')) {
        return { get: (key: string) => (store.has(key) ? { value: store.get(key) } : undefined) }
      }
      return {
        run: ({ key, value }: { key: string; value: string }) => {
          store.set(key, value)
        }
      }
    }
  })
  return { store }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('string settings with defaults', () => {
  it('returns the default until explicitly set, then round-trips the new value', () => {
    createFakeDb()
    expect(settings.getMagazineTitle()).toBe('TAG ME')
    settings.setMagazineTitle('My Mag')
    expect(settings.getMagazineTitle()).toBe('My Mag')

    expect(settings.getNewspaperTitle()).toBe('The Tag Me Times')
    settings.setNewspaperTitle('Daily News')
    expect(settings.getNewspaperTitle()).toBe('Daily News')

    expect(settings.getDvdStudioName()).toBe('TAG ME PICTURES')
    settings.setDvdStudioName('Studio')
    expect(settings.getDvdStudioName()).toBe('Studio')

    expect(settings.getArtGalleryName()).toBe('The Tag Me Gallery')
    settings.setArtGalleryName('Gallery')
    expect(settings.getArtGalleryName()).toBe('Gallery')
  })
})

describe('boolean settings defaulting to false when unset', () => {
  it('round-trips true/false for each toggle', () => {
    createFakeDb()
    const pairs: [() => boolean, (v: boolean) => void][] = [
      [settings.getShowEmptyFolders, settings.setShowEmptyFolders],
      [settings.getTagsPanelGridView, settings.setTagsPanelGridView],
      [settings.getPeoplePanelGridView, settings.setPeoplePanelGridView],
      [settings.getAiTagSuggestionsEnabled, settings.setAiTagSuggestionsEnabled],
      [settings.getFaceDetectionEnabled, settings.setFaceDetectionEnabled],
      [settings.getAiScanInProgress, settings.setAiScanInProgress],
      [settings.getDetailsPanelCollapsed, settings.setDetailsPanelCollapsed],
      [settings.getShowViewCounts, settings.setShowViewCounts]
    ]
    for (const [get, set] of pairs) {
      expect(get()).toBe(false)
      set(true)
      expect(get()).toBe(true)
      set(false)
      expect(get()).toBe(false)
    }
  })
})

describe('boolean settings defaulting to true when unset', () => {
  it('defaults true, but an explicit false persists', () => {
    createFakeDb()
    expect(settings.getGalleryAnimationsEnabled()).toBe(true)
    settings.setGalleryAnimationsEnabled(false)
    expect(settings.getGalleryAnimationsEnabled()).toBe(false)
    settings.setGalleryAnimationsEnabled(true)
    expect(settings.getGalleryAnimationsEnabled()).toBe(true)

    expect(settings.getShowFilenames()).toBe(true)
    settings.setShowFilenames(false)
    expect(settings.getShowFilenames()).toBe(false)
  })
})

describe('enum-like settings', () => {
  it('getDefaultView falls back to dashboard for anything but "gallery"', () => {
    createFakeDb()
    expect(settings.getDefaultView()).toBe('dashboard')
    settings.setDefaultView('gallery')
    expect(settings.getDefaultView()).toBe('gallery')
    settings.setDefaultView('dashboard')
    expect(settings.getDefaultView()).toBe('dashboard')
  })

  it('getGalleryViewMode falls back to grid for anything but "list"', () => {
    createFakeDb()
    expect(settings.getGalleryViewMode()).toBe('grid')
    settings.setGalleryViewMode('list')
    expect(settings.getGalleryViewMode()).toBe('list')
    settings.setGalleryViewMode('grid')
    expect(settings.getGalleryViewMode()).toBe('grid')
  })
})

describe('JSON array settings', () => {
  it('getFolders round-trips and defaults to [] when unset or malformed', () => {
    const { store } = createFakeDb()
    expect(settings.getFolders()).toEqual([])
    settings.setFolders(['/a', '/b'])
    expect(settings.getFolders()).toEqual(['/a', '/b'])

    store.set('watchedFolders', 'not json')
    expect(settings.getFolders()).toEqual([])

    // Non-array JSON, and a mixed-type array, are both filtered/rejected.
    store.set('watchedFolders', '{"not":"an array"}')
    expect(settings.getFolders()).toEqual([])
    store.set('watchedFolders', '["/a", 5, "/b"]')
    expect(settings.getFolders()).toEqual(['/a', '/b'])
  })

  it('getExcludePatterns and getExcludedFolders behave the same way', () => {
    const { store } = createFakeDb()
    expect(settings.getExcludePatterns()).toEqual([])
    settings.setExcludePatterns(['*.tmp'])
    expect(settings.getExcludePatterns()).toEqual(['*.tmp'])
    store.set('excludePatterns', 'garbage')
    expect(settings.getExcludePatterns()).toEqual([])

    expect(settings.getExcludedFolders()).toEqual([])
    settings.setExcludedFolders(['/skip'])
    expect(settings.getExcludedFolders()).toEqual(['/skip'])
    store.set('excludedFolders', 'garbage')
    expect(settings.getExcludedFolders()).toEqual([])
  })
})

describe('getGalleryCellWidth', () => {
  it('parses a stored number, defaulting to null when unset or non-numeric', () => {
    const { store } = createFakeDb()
    expect(settings.getGalleryCellWidth()).toBeNull()
    settings.setGalleryCellWidth(220)
    expect(settings.getGalleryCellWidth()).toBe(220)
    store.set('galleryCellWidth', 'not a number')
    expect(settings.getGalleryCellWidth()).toBeNull()
  })
})

describe('getGallerySort', () => {
  it('round-trips a valid sort object, and rejects malformed/incomplete JSON', () => {
    const { store } = createFakeDb()
    expect(settings.getGallerySort()).toBeNull()
    settings.setGallerySort({ sortBy: 'dateTaken', sortOrder: 'desc' })
    expect(settings.getGallerySort()).toEqual({ sortBy: 'dateTaken', sortOrder: 'desc' })

    store.set('gallerySort', 'not json')
    expect(settings.getGallerySort()).toBeNull()
    store.set('gallerySort', '{"sortBy":"dateTaken"}')
    expect(settings.getGallerySort()).toBeNull()
  })
})

describe('getNavbarSplitSizes', () => {
  it('round-trips a number array, and rejects a non-numeric or malformed array', () => {
    const { store } = createFakeDb()
    expect(settings.getNavbarSplitSizes()).toBeNull()
    settings.setNavbarSplitSizes([34, 33, 33])
    expect(settings.getNavbarSplitSizes()).toEqual([34, 33, 33])

    store.set('navbarSplitSizes', 'not json')
    expect(settings.getNavbarSplitSizes()).toBeNull()
    store.set('navbarSplitSizes', '["a", "b"]')
    expect(settings.getNavbarSplitSizes()).toBeNull()
  })
})

describe('getNavbarCollapsedPanels', () => {
  it('round-trips a record, defaulting to {} when unset or malformed', () => {
    const { store } = createFakeDb()
    expect(settings.getNavbarCollapsedPanels()).toEqual({})
    settings.setNavbarCollapsedPanels({ tags: true })
    expect(settings.getNavbarCollapsedPanels()).toEqual({ tags: true })

    store.set('navbarCollapsedPanels', 'not json')
    expect(settings.getNavbarCollapsedPanels()).toEqual({})
  })
})

describe('getAllSettings', () => {
  it('composes every setting into one object, mixing defaults and persisted values', () => {
    createFakeDb()
    settings.setMagazineTitle('My Mag')
    settings.setGallerySort({ sortBy: 'dateTaken', sortOrder: 'desc' })

    const all = settings.getAllSettings()

    expect(all.magazineTitle).toBe('My Mag')
    expect(all.gallerySort).toEqual({ sortBy: 'dateTaken', sortOrder: 'desc' })
    expect(all.defaultView).toBe('dashboard')
    expect(all.galleryAnimationsEnabled).toBe(true)
    expect(all.showFilenames).toBe(true)
    expect(all.showEmptyFolders).toBe(false)
    expect(all.navbarSplitSizes).toBeNull()
    expect(all.excludePatterns).toEqual([])
  })
})

describe('getWindowState', () => {
  it('round-trips a full window state, defaulting to null when unset', () => {
    createFakeDb()
    expect(settings.getWindowState()).toBeNull()

    const state = { x: 10, y: 20, width: 1600, height: 1000, maximized: true }
    settings.setWindowState(state)
    expect(settings.getWindowState()).toEqual(state)
  })

  it('rejects malformed or partial state rather than restoring a broken window', () => {
    const { store } = createFakeDb()

    store.set('windowState', 'not json')
    expect(settings.getWindowState()).toBeNull()

    // Missing height — enough to open a window with an undefined dimension.
    store.set('windowState', JSON.stringify({ x: 1, y: 2, width: 3, maximized: false }))
    expect(settings.getWindowState()).toBeNull()

    store.set('windowState', JSON.stringify({ x: 1, y: 2, width: 3, height: 4 }))
    expect(settings.getWindowState()).toBeNull()
  })
})
