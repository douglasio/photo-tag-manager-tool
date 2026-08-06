import type { DefaultView, GallerySort } from '@shared/types'

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

export function getAiTagSuggestionsEnabled(): boolean {
  return getSetting('aiTagSuggestionsEnabled') === 'true'
}

export function setAiTagSuggestionsEnabled(value: boolean): void {
  setSetting('aiTagSuggestionsEnabled', String(value))
}

// Defaults to Dashboard, same reasoning as getGalleryAnimationsEnabled above.
export function getDefaultView(): DefaultView {
  return getSetting('defaultView') === 'gallery' ? 'gallery' : 'dashboard'
}

export function setDefaultView(value: DefaultView): void {
  setSetting('defaultView', value)
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

const DEFAULT_MAGAZINE_TITLE = 'TAG ME'
const DEFAULT_NEWSPAPER_TITLE = 'The Tag Me Times'
const DEFAULT_DVD_STUDIO_NAME = 'TAG ME PICTURES'

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

export function getNavbarSplitSizes(): [number, number] | null {
  const raw = getSetting('navbarSplitSizes')
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      parsed.every((n) => typeof n === 'number')
    ) {
      return parsed as [number, number]
    }
    return null
  } catch {
    return null
  }
}

export function setNavbarSplitSizes(sizes: [number, number]): void {
  setSetting('navbarSplitSizes', JSON.stringify(sizes))
}
