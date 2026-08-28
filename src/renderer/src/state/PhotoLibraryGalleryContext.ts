import { createContext, useContext } from 'react'

import type { DefaultView, GalleryViewMode, PhotoRecord, ScanCompleteEvent } from '@shared/types'

import type { DisplayPhotoRecord, OpenTabEntry } from './PhotoLibraryContext'
import type { GallerySortBy, GallerySortOrder, ScanStatus } from './photoLibraryReducer'

// Photo data/viewport/scan/session state — what Gallery, PhotoView,
// Dashboard, DetailPanel, and Settings read. Settings-modal-adjacent fields
// (magazineTitle etc.) live here rather than a 4th context since their real
// consumers already need Gallery-bucket data too. See
// PhotoLibrarySidebarContext for the rest of PhotoLibraryState.
export interface GalleryLibraryState {
  photosByPath: Map<string, PhotoRecord>
  selectedPath: string | null
  selectedPaths: Set<string>
  status: ScanStatus
  initialLoadComplete: boolean
  filesFound: number
  cacheHits: number
  errors: ScanCompleteEvent['errors']
  scanId: string | null
  sortBy: GallerySortBy
  sortOrder: GallerySortOrder
  galleryViewMode: GalleryViewMode
  galleryAnimationsEnabled: boolean
  galleryCellWidth: number
  searchResults: { paths: Set<string>; label: string } | null
  showFilenames: boolean
  showViewCounts: boolean
  defaultView: DefaultView
  aiTagSuggestionsEnabled: boolean
  settingsModalOpened: boolean
  detailsPanelCollapsed: boolean
  magazineTitle: string
  newspaperTitle: string
  dvdStudioName: string
  artGalleryName: string
  excludePatterns: string[]
  openTabs: string[]
  activeTab: string
  compareTabs: Map<string, string[]>
}

export interface PhotoLibraryGalleryValue {
  state: GalleryLibraryState
  photos: PhotoRecord[]
  visiblePhotos: PhotoRecord[]
  // The library-wide "feature" photo set (excludes excluded-folder photos
  // unconditionally) — the choke point Dashboard widgets should read from
  // instead of state.photosByPath, so exclusion isn't something each one has
  // to remember to apply itself.
  activePhotosByPath: Map<string, PhotoRecord>
  selectedPhoto: DisplayPhotoRecord | null
  openTabEntries: OpenTabEntry[]
}

export const PhotoLibraryGalleryContext = createContext<PhotoLibraryGalleryValue | null>(null)

export function useGalleryLibrary(): PhotoLibraryGalleryValue {
  const ctx = useContext(PhotoLibraryGalleryContext)
  if (!ctx) throw new Error('useGalleryLibrary must be used within a PhotoLibraryProvider')
  return ctx
}
