import type {
  AppSettings,
  DefaultView,
  GallerySort,
  GalleryViewMode,
  WindowState
} from '@shared/types'

import { getDb } from './database'

function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    { value: string } | undefined
  return row?.value ?? null
}

function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (@key, @value)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run({ key, value })
}

export function getFolders(): string[] {
  const raw = getSetting('watchedFolders')
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

export function setFolders(folders: string[]): void {
  setSetting('watchedFolders', JSON.stringify(folders))
}

export function getGalleryCellWidth(): number | null {
  const raw = getSetting('galleryCellWidth')
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

export function setGalleryCellWidth(width: number): void {
  setSetting('galleryCellWidth', String(width))
}

export function getGallerySort(): GallerySort | null {
  const raw = getSetting('gallerySort')
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'sortBy' in parsed &&
      'sortOrder' in parsed
    ) {
      return parsed as GallerySort
    }
    return null
  } catch {
    return null
  }
}

export function setGallerySort(sort: GallerySort): void {
  setSetting('gallerySort', JSON.stringify(sort))
}

export function getShowEmptyFolders(): boolean {
  return getSetting('showEmptyFolders') === 'true'
}

export function setShowEmptyFolders(value: boolean): void {
  setSetting('showEmptyFolders', String(value))
}

export function getTagsPanelGridView(): boolean {
  return getSetting('tagsPanelGridView') === 'true'
}

export function setTagsPanelGridView(value: boolean): void {
  setSetting('tagsPanelGridView', String(value))
}

export function getPeoplePanelGridView(): boolean {
  return getSetting('peoplePanelGridView') === 'true'
}

export function setPeoplePanelGridView(value: boolean): void {
  setSetting('peoplePanelGridView', String(value))
}

export function getAiTagSuggestionsEnabled(): boolean {
  return getSetting('aiTagSuggestionsEnabled') === 'true'
}

export function setAiTagSuggestionsEnabled(value: boolean): void {
  setSetting('aiTagSuggestionsEnabled', String(value))
}

// Its own toggle, separate from aiTagSuggestionsEnabled — face detection is
// a heavier, more optional pass most users may not want even if they want
// tag suggestions.
export function getFaceDetectionEnabled(): boolean {
  return getSetting('faceDetectionEnabled') === 'true'
}

export function setFaceDetectionEnabled(value: boolean): void {
  setSetting('faceDetectionEnabled', String(value))
}

// Set while a scan is running and cleared when it finishes for any reason
// while the app is still alive (success, error, or user cancel) — so if it's
// still true on the next launch, the previous scan was cut off by a quit
// rather than resolved, and is safe to silently resume.
export function getAiScanInProgress(): boolean {
  return getSetting('aiScanInProgress') === 'true'
}

export function setAiScanInProgress(value: boolean): void {
  setSetting('aiScanInProgress', String(value))
}

// Defaults to Dashboard, same reasoning as getGalleryAnimationsEnabled above.
export function getDefaultView(): DefaultView {
  return getSetting('defaultView') === 'gallery' ? 'gallery' : 'dashboard'
}

export function setDefaultView(value: DefaultView): void {
  setSetting('defaultView', value)
}

export function getGalleryViewMode(): GalleryViewMode {
  return getSetting('galleryViewMode') === 'list' ? 'list' : 'grid'
}

export function setGalleryViewMode(value: GalleryViewMode): void {
  setSetting('galleryViewMode', value)
}

export function getDetailsPanelCollapsed(): boolean {
  return getSetting('detailsPanelCollapsed') === 'true'
}

export function setDetailsPanelCollapsed(value: boolean): void {
  setSetting('detailsPanelCollapsed', String(value))
}

// Defaults to on (unlike the other boolean settings above, which default
// off) — unset means "never explicitly toggled," not "explicitly disabled."
export function getGalleryAnimationsEnabled(): boolean {
  const raw = getSetting('galleryAnimationsEnabled')
  return raw === null ? true : raw === 'true'
}

export function setGalleryAnimationsEnabled(value: boolean): void {
  setSetting('galleryAnimationsEnabled', String(value))
}

// Defaults to on, same reasoning as getGalleryAnimationsEnabled above.
export function getShowFilenames(): boolean {
  const raw = getSetting('showFilenames')
  return raw === null ? true : raw === 'true'
}

export function setShowFilenames(value: boolean): void {
  setSetting('showFilenames', String(value))
}

// Defaults to off — an opt-in badge, not something that should suddenly
// appear for existing users on upgrade.
export function getShowViewCounts(): boolean {
  return getSetting('showViewCounts') === 'true'
}

export function setShowViewCounts(value: boolean): void {
  setSetting('showViewCounts', String(value))
}

export function getExcludePatterns(): string[] {
  const raw = getSetting('excludePatterns')
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

export function setExcludePatterns(patterns: string[]): void {
  setSetting('excludePatterns', JSON.stringify(patterns))
}

// Folders (and everything beneath them) excluded from tags, AI features,
// duplicate detection, Time Warp, and dashboard widgets — the files remain
// scanned/watched normally (unlike excludePatterns above) and are still
// browsable by navigating directly to the folder itself.
export function getExcludedFolders(): string[] {
  const raw = getSetting('excludedFolders')
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

export function setExcludedFolders(folders: string[]): void {
  setSetting('excludedFolders', JSON.stringify(folders))
}

const DEFAULT_MAGAZINE_TITLE = 'TAG ME'
const DEFAULT_NEWSPAPER_TITLE = 'The Tag Me Times'
const DEFAULT_DVD_STUDIO_NAME = 'TAG ME PICTURES'
const DEFAULT_ART_GALLERY_NAME = 'The Tag Me Gallery'

export function getMagazineTitle(): string {
  return getSetting('magazineTitle') ?? DEFAULT_MAGAZINE_TITLE
}

export function setMagazineTitle(value: string): void {
  setSetting('magazineTitle', value)
}

export function getNewspaperTitle(): string {
  return getSetting('newspaperTitle') ?? DEFAULT_NEWSPAPER_TITLE
}

export function setNewspaperTitle(value: string): void {
  setSetting('newspaperTitle', value)
}

export function getDvdStudioName(): string {
  return getSetting('dvdStudioName') ?? DEFAULT_DVD_STUDIO_NAME
}

export function setDvdStudioName(value: string): void {
  setSetting('dvdStudioName', value)
}

export function getArtGalleryName(): string {
  return getSetting('artGalleryName') ?? DEFAULT_ART_GALLERY_NAME
}

export function setArtGalleryName(value: string): void {
  setSetting('artGalleryName', value)
}

// Variable length rather than a fixed tuple — the navbar's Splitter gains a
// People pane (3 panes) once face detection is enabled, or drops back to 2
// when it's off, so the persisted array's length tracks whichever pane count
// was actually being resized. A length mismatch (e.g. stored 2 values but
// People is now shown) is handled by the caller falling back to a default
// for the current pane count, not here.
export function getNavbarSplitSizes(): number[] | null {
  const raw = getSetting('navbarSplitSizes')
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
      return parsed as number[]
    }
    return null
  } catch {
    return null
  }
}

export function setNavbarSplitSizes(sizes: number[]): void {
  setSetting('navbarSplitSizes', JSON.stringify(sizes))
}

// The sidebar's overall width in px, distinct from navbarSplitSizes above
// (which only divides the Tags/People/Folders panes within it). Clamping to
// the usable range is the renderer's job, same as galleryCellWidth.
export function getNavbarWidth(): number | null {
  const raw = getSetting('navbarWidth')
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

export function setNavbarWidth(width: number): void {
  setSetting('navbarWidth', String(width))
}

// The main window's last position/size, so a relaunch reopens where the user
// left it. Stored here rather than in a separate file (the `electron-window-
// state` convention) so it travels with the existing settings table through
// database export/import. Whether the saved rect is still usable — the
// display it was on may be gone — is decided at launch by
// resolveWindowBounds, not here.
export function getWindowState(): WindowState | null {
  const raw = getSetting('windowState')
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isWindowState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function setWindowState(state: WindowState): void {
  setSetting('windowState', JSON.stringify(state))
}

function isWindowState(value: unknown): value is WindowState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(candidate[key])) &&
    typeof candidate.maximized === 'boolean'
  )
}

// Keyed by a stable panel id ('tags' | 'people' | 'folders'), not pane
// index — index would silently mean something different if the panes are
// ever reordered again. Missing key means expanded (the default).
export function getNavbarCollapsedPanels(): Record<string, boolean> {
  const raw = getSetting('navbarCollapsedPanels')
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function setNavbarCollapsedPanels(value: Record<string, boolean>): void {
  setSetting('navbarCollapsedPanels', JSON.stringify(value))
}

// Batches every setting PhotoLibraryContext's startup effect needs into one
// call, instead of ~20 separate IPC round-trips on mount.
export function getAllSettings(): AppSettings {
  return {
    gallerySort: getGallerySort(),
    defaultView: getDefaultView(),
    showEmptyFolders: getShowEmptyFolders(),
    tagsPanelGridView: getTagsPanelGridView(),
    peoplePanelGridView: getPeoplePanelGridView(),
    galleryViewMode: getGalleryViewMode(),
    aiTagSuggestionsEnabled: getAiTagSuggestionsEnabled(),
    faceDetectionEnabled: getFaceDetectionEnabled(),
    detailsPanelCollapsed: getDetailsPanelCollapsed(),
    galleryAnimationsEnabled: getGalleryAnimationsEnabled(),
    showFilenames: getShowFilenames(),
    showViewCounts: getShowViewCounts(),
    magazineTitle: getMagazineTitle(),
    newspaperTitle: getNewspaperTitle(),
    dvdStudioName: getDvdStudioName(),
    artGalleryName: getArtGalleryName(),
    navbarSplitSizes: getNavbarSplitSizes(),
    navbarWidth: getNavbarWidth(),
    navbarCollapsedPanels: getNavbarCollapsedPanels(),
    excludePatterns: getExcludePatterns(),
    excludedFolders: getExcludedFolders()
  }
}
