import { createContext, useContext } from 'react'

import type {
  AiScanResult,
  DefaultView,
  FaceRecord,
  FaceScanResult,
  GalleryViewMode,
  PersonRecord,
  RotateDirection,
  SimilarPhoto,
  TagSuggestion,
  ThrowbackEntry,
  ThrowbackYearSample
} from '@shared/types'

import type { NavigationDirection, PhotoVisualization } from './PhotoLibraryContext'
import type { GallerySortBy, GallerySortOrder } from './photoLibraryReducer'

// Every action callback in the app, bundled into one context — safe to keep
// broad (unlike the state-derived contexts) because every action here is a
// permanently-stable useCallback (see PhotoLibraryProvider's stateRef/
// visiblePhotosRef pattern), so this bag's own identity never changes and
// consuming it never causes a re-render on its own.
export interface LibraryActions {
  addFolder: () => Promise<void>
  removeFolder: (folder: string) => Promise<void>
  renameFolder: (folder: string, newBaseName: string) => Promise<void>
  excludeFolder: (folder: string) => Promise<void>
  includeFolder: (folder: string) => Promise<void>
  cancelScan: () => Promise<void>
  rescanAll: () => Promise<void>
  selectPhoto: (path: string | null) => void
  toggleSelectPhoto: (path: string) => void
  selectPhotoRange: (targetPath: string) => void
  clearSelection: () => void
  addTagsToSelection: (tags: string[]) => Promise<void>
  addTagsToPhotos: (tags: string[], filePaths: string[]) => Promise<void>
  removeTagsFromSelection: (tags: string[]) => Promise<void>
  removeTagsFromPhotos: (tags: string[], filePaths: string[]) => Promise<void>
  movePhotosToFolder: (filePaths: string[], destFolder: string) => Promise<void>
  deletePhotos: (filePaths: string[]) => Promise<void>
  setFolderFilter: (folder: string | null) => void
  setTagFilter: (tag: string | null) => void
  setFolderTagFilter: (tag: string | null) => void
  setPersonFilter: (personId: string | null) => void
  setUntaggedFilter: (active: boolean) => void
  setFolderUntaggedFilter: (active: boolean) => void
  setSort: (sortBy: GallerySortBy, sortOrder: GallerySortOrder) => void
  setDefaultView: (value: DefaultView) => void
  setShowEmptyFolders: (value: boolean) => void
  setTagsPanelGridView: (value: boolean) => void
  setPeoplePanelGridView: (value: boolean) => void
  setGalleryViewMode: (value: GalleryViewMode) => void
  setAiTagSuggestionsEnabled: (value: boolean) => void
  suggestTags: (filePath: string, candidateLabels: string[]) => Promise<TagSuggestion[]>
  findSimilarPhotos: (filePath: string, limit: number) => Promise<SimilarPhoto[]>
  dismissDuplicateGroup: (filePaths: string[]) => Promise<void>
  openDuplicatesTab: () => void
  getThrowbackSimilarity: () => Promise<ThrowbackEntry[] | null>
  getThrowbackYearSample: () => Promise<ThrowbackYearSample | null>
  getThrowbackPreview: () => Promise<ThrowbackEntry[] | null>
  enableAiFeatures: () => Promise<AiScanResult>
  rescanAiFeatures: () => Promise<AiScanResult>
  cancelAiScan: () => void
  setFaceDetectionEnabled: (value: boolean) => void
  enableFaceDetection: () => Promise<FaceScanResult>
  rescanFaces: () => Promise<FaceScanResult>
  cancelFaceScan: () => void
  getFacesForPhoto: (filePath: string) => Promise<FaceRecord[]>
  refreshPeople: () => Promise<void>
  renamePerson: (id: string, name: string) => Promise<void>
  assignFaceToPerson: (faceId: string, personId: string) => Promise<void>
  splitFaceAsNewPerson: (faceId: string) => Promise<void>
  unassignFace: (faceId: string) => Promise<void>
  mergePeople: (sourcePersonId: string, targetPersonId: string) => Promise<void>
  deletePerson: (id: string) => Promise<void>
  setPersonDescription: (id: string, description: string) => Promise<void>
  hidePerson: (id: string) => Promise<void>
  unhidePerson: (id: string) => Promise<void>
  getHiddenPeople: () => Promise<PersonRecord[]>
  setNavbarSplitSizes: (sizes: number[]) => void
  setNavbarWidth: (width: number) => void
  setNavbarCollapsedPanels: (panels: Record<string, boolean>) => void
  setSettingsModalOpened: (value: boolean) => void
  setDetailsPanelCollapsed: (value: boolean) => void
  setGalleryAnimationsEnabled: (value: boolean) => void
  setShowFilenames: (value: boolean) => void
  setShowViewCounts: (value: boolean) => void
  setMagazineTitle: (value: string) => void
  setNewspaperTitle: (value: string) => void
  setDvdStudioName: (value: string) => void
  setArtGalleryName: (value: string) => void
  setExcludePatterns: (patterns: string[]) => Promise<void>
  updateTags: (filePath: string, tags: string[]) => Promise<void>
  setTagDescription: (tag: string, description: string) => Promise<void>
  renameTag: (oldTag: string, newTag: string) => Promise<void>
  deleteTag: (tag: string) => Promise<void>
  createTagGroup: (name: string, matchPattern?: string | null) => Promise<void>
  renameTagGroup: (id: string, name: string) => Promise<void>
  updateTagGroupPattern: (id: string, matchPattern: string | null) => Promise<void>
  deleteTagGroup: (id: string) => Promise<void>
  assignTagToGroup: (tag: string, groupId: string | null) => Promise<void>
  renameFile: (filePath: string, newBaseName: string) => Promise<void>
  updateDateTaken: (filePath: string, isoDate: string) => Promise<void>
  updateComment: (filePath: string, comment: string) => Promise<void>
  rotatePhoto: (filePath: string, direction: RotateDirection) => Promise<void>
  incrementViewCount: (filePath: string) => Promise<void>
  openPhotoTab: (filePath: string) => void
  openCompareTab: (paths: string[]) => void
  removeFromCompareTab: (tabId: string, filePath: string) => void
  closePhotoTab: (filePath: string) => void
  closeAllTabs: () => void
  setActiveTab: (tab: string) => void
  reorderPhotoTabs: (openTabs: string[]) => void
  navigateToPhoto: (
    fromPath: string,
    toPath: string,
    direction: NavigationDirection,
    visualization: PhotoVisualization
  ) => void
  consumeNavDirection: (filePath: string) => NavigationDirection | null
  consumeVisualization: (filePath: string) => PhotoVisualization | null
}

export const PhotoLibraryActionsContext = createContext<LibraryActions | null>(null)

export function useLibraryActions(): LibraryActions {
  const ctx = useContext(PhotoLibraryActionsContext)
  if (!ctx) throw new Error('useLibraryActions must be used within a PhotoLibraryProvider')
  return ctx
}
