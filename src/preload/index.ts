import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'

import type {
  AiScanProgress,
  AiScanResult,
  AppSettings,
  DefaultView,
  FaceRecord,
  FaceScanProgress,
  FaceScanResult,
  GallerySort,
  GalleryViewMode,
  MetadataBatchEvent,
  MoveProgressEvent,
  PersonRecord,
  PhotoRecord,
  RotateDirection,
  ScanCompleteEvent,
  ScanProgressEvent,
  ScanStartResult,
  SimilarPhoto,
  TagGroup,
  TagSuggestion,
  ThrowbackEntry,
  ThrowbackYearSample,
  WatchFolderAddedEvent,
  WatchFolderRemovedEvent,
  WatchPhotoRemovedEvent,
  WatchPhotoUpsertedEvent
} from '@shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  getFolders: (): Promise<string[]> => ipcRenderer.invoke('settings:getFolders'),
  getAllSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:getAllSettings'),
  showItemInFolder: (path: string) => ipcRenderer.invoke('show-item-in-folder', path),
  renamePhoto: (filePath: string, newBaseName: string): Promise<PhotoRecord> =>
    ipcRenderer.invoke('photo:rename', filePath, newBaseName),
  updateDateTaken: (filePath: string, isoDate: string): Promise<PhotoRecord> =>
    ipcRenderer.invoke('photo:updateDateTaken', filePath, isoDate),
  updateComment: (filePath: string, comment: string): Promise<PhotoRecord> =>
    ipcRenderer.invoke('photo:updateComment', filePath, comment),
  incrementPhotoView: (filePath: string): Promise<PhotoRecord | null> =>
    ipcRenderer.invoke('photo:incrementView', filePath),
  rotatePhoto: (filePath: string, direction: RotateDirection): Promise<PhotoRecord> =>
    ipcRenderer.invoke('photo:rotate', filePath, direction),
  movePhotosToFolder: (
    filePaths: string[],
    destFolder: string
  ): Promise<{ moved: { oldPath: string; photo: PhotoRecord }[]; skipped: number }> =>
    ipcRenderer.invoke('photo:moveToFolder', filePaths, destFolder),
  onMoveProgress: (callback: (payload: MoveProgressEvent) => void): (() => void) =>
    subscribe('photo:moveProgress', callback),
  // Resolves with only the paths actually deleted — a partial batch failure
  // isn't thrown, since the caller still needs to know which ones landed.
  deletePhotos: (filePaths: string[]): Promise<string[]> =>
    ipcRenderer.invoke('photo:delete', filePaths),
  getGalleryCellWidth: (): Promise<number | null> =>
    ipcRenderer.invoke('settings:getGalleryCellWidth'),
  setGalleryCellWidth: (width: number): Promise<void> =>
    ipcRenderer.invoke('settings:setGalleryCellWidth', width),
  getGallerySort: (): Promise<GallerySort | null> => ipcRenderer.invoke('settings:getGallerySort'),
  setGallerySort: (sort: GallerySort): Promise<void> =>
    ipcRenderer.invoke('settings:setGallerySort', sort),
  getDefaultView: (): Promise<DefaultView> => ipcRenderer.invoke('settings:getDefaultView'),
  setDefaultView: (value: DefaultView): Promise<void> =>
    ipcRenderer.invoke('settings:setDefaultView', value),
  getShowEmptyFolders: (): Promise<boolean> => ipcRenderer.invoke('settings:getShowEmptyFolders'),
  setShowEmptyFolders: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setShowEmptyFolders', value),
  getTagsPanelGridView: (): Promise<boolean> => ipcRenderer.invoke('settings:getTagsPanelGridView'),
  setTagsPanelGridView: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setTagsPanelGridView', value),
  getPeoplePanelGridView: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:getPeoplePanelGridView'),
  setPeoplePanelGridView: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setPeoplePanelGridView', value),
  getGalleryViewMode: (): Promise<GalleryViewMode> =>
    ipcRenderer.invoke('settings:getGalleryViewMode'),
  setGalleryViewMode: (value: GalleryViewMode): Promise<void> =>
    ipcRenderer.invoke('settings:setGalleryViewMode', value),
  getAiTagSuggestionsEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:getAiTagSuggestionsEnabled'),
  setAiTagSuggestionsEnabled: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setAiTagSuggestionsEnabled', value),
  suggestTags: (filePath: string, candidateLabels: string[]): Promise<TagSuggestion[]> =>
    ipcRenderer.invoke('ai:suggestTags', filePath, candidateLabels),
  enableAiFeaturesAndScan: (): Promise<AiScanResult> => ipcRenderer.invoke('ai:enableAndScan'),
  rescanAiFeatures: (): Promise<AiScanResult> => ipcRenderer.invoke('ai:rescan'),
  cancelAiScan: (): Promise<void> => ipcRenderer.invoke('ai:cancelScan'),
  wasAiScanInterrupted: (): Promise<boolean> => ipcRenderer.invoke('ai:wasScanInterrupted'),
  onAiScanProgress: (callback: (progress: AiScanProgress) => void): (() => void) =>
    subscribe('ai:scanProgress', callback),
  findSimilarPhotos: (filePath: string, limit: number): Promise<SimilarPhoto[]> =>
    ipcRenderer.invoke('ai:findSimilarPhotos', filePath, limit),
  dismissDuplicateGroup: (filePaths: string[]): Promise<void> =>
    ipcRenderer.invoke('ai:dismissDuplicateGroup', filePaths),
  getFaceDetectionEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:getFaceDetectionEnabled'),
  setFaceDetectionEnabled: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setFaceDetectionEnabled', value),
  getFacesForPhoto: (filePath: string): Promise<FaceRecord[]> =>
    ipcRenderer.invoke('faces:getForPhoto', filePath),
  getPeople: (): Promise<PersonRecord[]> => ipcRenderer.invoke('faces:getPeople'),
  getFacePhotoAssignments: (): Promise<{ photoPath: string; personId: string }[]> =>
    ipcRenderer.invoke('faces:getPhotoAssignments'),
  enableFaceDetectionAndScan: (): Promise<FaceScanResult> =>
    ipcRenderer.invoke('faces:enableAndScan'),
  rescanFaces: (): Promise<FaceScanResult> => ipcRenderer.invoke('faces:rescan'),
  cancelFaceScan: (): Promise<void> => ipcRenderer.invoke('faces:cancelScan'),
  onFaceScanProgress: (callback: (progress: FaceScanProgress) => void): (() => void) =>
    subscribe('faces:scanProgress', callback),
  renamePerson: (id: string, name: string): Promise<void> =>
    ipcRenderer.invoke('faces:renamePerson', id, name),
  assignFaceToPerson: (faceId: string, personId: string): Promise<void> =>
    ipcRenderer.invoke('faces:assignFaceToPerson', faceId, personId),
  splitFaceAsNewPerson: (faceId: string): Promise<PersonRecord> =>
    ipcRenderer.invoke('faces:splitFaceAsNewPerson', faceId),
  unassignFace: (faceId: string): Promise<void> => ipcRenderer.invoke('faces:unassignFace', faceId),
  mergePeople: (sourcePersonId: string, targetPersonId: string): Promise<void> =>
    ipcRenderer.invoke('faces:mergePeople', sourcePersonId, targetPersonId),
  deletePerson: (id: string): Promise<void> => ipcRenderer.invoke('faces:deletePerson', id),
  setPersonDescription: (id: string, description: string): Promise<void> =>
    ipcRenderer.invoke('faces:setDescription', id, description),
  hidePerson: (id: string): Promise<void> => ipcRenderer.invoke('faces:hidePerson', id),
  unhidePerson: (id: string): Promise<void> => ipcRenderer.invoke('faces:unhidePerson', id),
  getHiddenPeople: (): Promise<PersonRecord[]> => ipcRenderer.invoke('faces:getHiddenPeople'),
  getThrowbackSimilarity: (): Promise<ThrowbackEntry[] | null> =>
    ipcRenderer.invoke('throwback:getSimilarity'),
  getThrowbackYearSample: (): Promise<ThrowbackYearSample | null> =>
    ipcRenderer.invoke('throwback:getYearSample'),
  getThrowbackPreview: (): Promise<ThrowbackEntry[] | null> =>
    ipcRenderer.invoke('throwback:getPreview'),
  getDetailsPanelCollapsed: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:getDetailsPanelCollapsed'),
  setDetailsPanelCollapsed: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setDetailsPanelCollapsed', value),
  getGalleryAnimationsEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:getGalleryAnimationsEnabled'),
  setGalleryAnimationsEnabled: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setGalleryAnimationsEnabled', value),
  getShowFilenames: (): Promise<boolean> => ipcRenderer.invoke('settings:getShowFilenames'),
  setShowFilenames: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setShowFilenames', value),
  getShowViewCounts: (): Promise<boolean> => ipcRenderer.invoke('settings:getShowViewCounts'),
  setShowViewCounts: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setShowViewCounts', value),
  getMagazineTitle: (): Promise<string> => ipcRenderer.invoke('settings:getMagazineTitle'),
  setMagazineTitle: (value: string): Promise<void> =>
    ipcRenderer.invoke('settings:setMagazineTitle', value),
  getNewspaperTitle: (): Promise<string> => ipcRenderer.invoke('settings:getNewspaperTitle'),
  setNewspaperTitle: (value: string): Promise<void> =>
    ipcRenderer.invoke('settings:setNewspaperTitle', value),
  getDvdStudioName: (): Promise<string> => ipcRenderer.invoke('settings:getDvdStudioName'),
  setDvdStudioName: (value: string): Promise<void> =>
    ipcRenderer.invoke('settings:setDvdStudioName', value),
  getArtGalleryName: (): Promise<string> => ipcRenderer.invoke('settings:getArtGalleryName'),
  setArtGalleryName: (value: string): Promise<void> =>
    ipcRenderer.invoke('settings:setArtGalleryName', value),
  getNavbarSplitSizes: (): Promise<number[] | null> =>
    ipcRenderer.invoke('settings:getNavbarSplitSizes'),
  setNavbarSplitSizes: (sizes: number[]): Promise<void> =>
    ipcRenderer.invoke('settings:setNavbarSplitSizes', sizes),
  getNavbarCollapsedPanels: (): Promise<Record<string, boolean>> =>
    ipcRenderer.invoke('settings:getNavbarCollapsedPanels'),
  setNavbarCollapsedPanels: (value: Record<string, boolean>): Promise<void> =>
    ipcRenderer.invoke('settings:setNavbarCollapsedPanels', value),
  getExcludePatterns: (): Promise<string[]> => ipcRenderer.invoke('settings:getExcludePatterns'),
  setExcludePatterns: (patterns: string[]): Promise<void> =>
    ipcRenderer.invoke('settings:setExcludePatterns', patterns),
  getExcludedFolders: (): Promise<string[]> => ipcRenderer.invoke('settings:getExcludedFolders'),
  setExcludedFolders: (folders: string[]): Promise<void> =>
    ipcRenderer.invoke('settings:setExcludedFolders', folders),
  addFolder: (folder: string): Promise<void> => ipcRenderer.invoke('settings:addFolder', folder),
  removeFolder: (folder: string): Promise<void> =>
    ipcRenderer.invoke('settings:removeFolder', folder),
  renameFolder: (folder: string, newBaseName: string): Promise<string> =>
    ipcRenderer.invoke('settings:renameFolder', folder, newBaseName),
  exportDatabase: (): Promise<boolean> => ipcRenderer.invoke('library:exportDatabase'),
  importDatabase: (): Promise<void> => ipcRenderer.invoke('library:importDatabase'),
  clearLibrary: (): Promise<void> => ipcRenderer.invoke('library:clearLibrary'),
  startScan: (rootPath: string): Promise<ScanStartResult> =>
    ipcRenderer.invoke('scan:start', rootPath),
  startScanAll: (rootPaths: string[]): Promise<ScanStartResult> =>
    ipcRenderer.invoke('scan:startAll', rootPaths),
  cancelScan: (scanId: string): Promise<void> => ipcRenderer.invoke('scan:cancel', scanId),
  updateTags: (filePath: string, tags: string[]): Promise<PhotoRecord> =>
    ipcRenderer.invoke('tags:update', filePath, tags),
  getTagDescriptions: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke('tags:getDescriptions'),
  setTagDescription: (tag: string, description: string): Promise<void> =>
    ipcRenderer.invoke('tags:setDescription', tag, description),
  renameTag: (oldTag: string, newTag: string, filePaths: string[]): Promise<PhotoRecord[]> =>
    ipcRenderer.invoke('tags:rename', oldTag, newTag, filePaths),
  deleteTag: (tag: string, filePaths: string[]): Promise<PhotoRecord[]> =>
    ipcRenderer.invoke('tags:delete', tag, filePaths),
  addTagsToPhotos: (tags: string[], filePaths: string[]): Promise<PhotoRecord[]> =>
    ipcRenderer.invoke('tags:addBatch', tags, filePaths),
  removeTagsFromPhotos: (tags: string[], filePaths: string[]): Promise<PhotoRecord[]> =>
    ipcRenderer.invoke('tags:removeBatch', tags, filePaths),
  getTagGroupsData: (): Promise<{ groups: TagGroup[]; assignments: Record<string, string> }> =>
    ipcRenderer.invoke('tags:getGroupsData'),
  createTagGroup: (name: string, matchPattern: string | null): Promise<TagGroup> =>
    ipcRenderer.invoke('tags:createGroup', name, matchPattern),
  renameTagGroup: (id: string, name: string): Promise<void> =>
    ipcRenderer.invoke('tags:renameGroup', id, name),
  setTagGroupMatchPattern: (id: string, matchPattern: string | null): Promise<void> =>
    ipcRenderer.invoke('tags:setGroupMatchPattern', id, matchPattern),
  deleteTagGroup: (id: string): Promise<void> => ipcRenderer.invoke('tags:deleteGroup', id),
  setTagGroupAssignment: (tag: string, groupId: string | null): Promise<void> =>
    ipcRenderer.invoke('tags:setGroupAssignment', tag, groupId),
  onScanProgress: (callback: (payload: ScanProgressEvent) => void): (() => void) =>
    subscribe('scan:progress', callback),
  onMetadataBatch: (callback: (payload: MetadataBatchEvent) => void): (() => void) =>
    subscribe('scan:metadata-batch', callback),
  onScanComplete: (callback: (payload: ScanCompleteEvent) => void): (() => void) =>
    subscribe('scan:complete', callback),
  onPhotoUpserted: (callback: (payload: WatchPhotoUpsertedEvent) => void): (() => void) =>
    subscribe('watch:photo-upserted', callback),
  onPhotoRemoved: (callback: (payload: WatchPhotoRemovedEvent) => void): (() => void) =>
    subscribe('watch:photo-removed', callback),
  onFolderAdded: (callback: (payload: WatchFolderAddedEvent) => void): (() => void) =>
    subscribe('watch:folder-added', callback),
  onFolderRemoved: (callback: (payload: WatchFolderRemovedEvent) => void): (() => void) =>
    subscribe('watch:folder-removed', callback)
}

export type PhotagApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
