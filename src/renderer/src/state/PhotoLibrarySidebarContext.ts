import { createContext, useContext } from 'react'

import type { PersonRecord, PhotoRecord, TagGroup } from '@shared/types'

// Filter/selection/taxonomy state — what the Folders/Tags/People sidebar
// panels read. Deliberately excludes photosByPath and anything derived from
// it beyond the tag/folder aggregates below, so a Gallery-only change (photo
// selection, view-count bump, scan progress) never touches this context's
// identity. See PhotoLibraryGalleryContext for the rest of PhotoLibraryState.
export interface SidebarLibraryState {
  folders: string[]
  folderCounts: Map<string, number>
  folderChildren: Map<string, Set<string>>
  allFolderPaths: Set<string>
  excludedFolders: string[]
  showEmptyFolders: boolean
  selectedFolder: string | null
  selectedTag: string | null
  selectedPerson: string | null
  untaggedFilterActive: boolean
  people: PersonRecord[]
  personPhotoAssignments: Map<string, Set<string>>
  faceDetectionEnabled: boolean
  peoplePanelGridView: boolean
  tagsPanelGridView: boolean
  tagGroups: TagGroup[]
  tagGroupAssignments: Map<string, string>
  tagDescriptions: Map<string, string>
  recentTags: string[]
  navbarSplitSizes: number[]
  navbarCollapsedPanels: Record<string, boolean>
}

export interface PhotoLibrarySidebarValue {
  state: SidebarLibraryState
  allTags: string[]
  tagCounts: Map<string, number>
  tagCoverPhotos: Map<string, PhotoRecord>
  tagViewCounts: Map<string, number>
  untaggedCount: number
  folderTags: string[]
  folderHasUntagged: boolean
  // personId -> cover photo's thumbnailKey (or null) — computed here rather
  // than having PersonRow read state.photosByPath directly, so a Gallery-only
  // photo write doesn't need to touch this context to keep PersonRow correct.
  personCoverPhotos: Map<string, string | null>
}

export const PhotoLibrarySidebarContext = createContext<PhotoLibrarySidebarValue | null>(null)

export function useSidebarLibrary(): PhotoLibrarySidebarValue {
  const ctx = useContext(PhotoLibrarySidebarContext)
  if (!ctx) throw new Error('useSidebarLibrary must be used within a PhotoLibraryProvider')
  return ctx
}
