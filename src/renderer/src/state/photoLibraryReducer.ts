import {
  addPhotoToFolderTree,
  findRootFolder,
  isPathUnderOrEqual,
  removePhotoFromFolderTree
} from '../utils/folderTree'
import type { PhotoRecord, ScanCompleteEvent } from '../../../shared/types'

export type ScanStatus = 'idle' | 'scanning' | 'complete' | 'canceled'

export interface PhotoLibraryState {
  folders: string[]
  rootPath: string | null
  scanId: string | null
  status: ScanStatus
  filesFound: number
  photosByPath: Map<string, PhotoRecord>
  cacheHits: number
  errors: ScanCompleteEvent['errors']
  selectedPath: string | null
  selectedFolder: string | null
  selectedTag: string | null
  folderCounts: Map<string, number>
  folderChildren: Map<string, Set<string>>
}

export const initialState: PhotoLibraryState = {
  folders: [],
  rootPath: null,
  scanId: null,
  status: 'idle',
  filesFound: 0,
  photosByPath: new Map(),
  cacheHits: 0,
  errors: [],
  selectedPath: null,
  selectedFolder: null,
  selectedTag: null,
  folderCounts: new Map(),
  folderChildren: new Map()
}

export type PhotoLibraryAction =
  | { type: 'FOLDERS_LOADED'; folders: string[] }
  | { type: 'FOLDER_ADDED'; folder: string }
  | { type: 'FOLDER_REMOVED'; folder: string }
  | { type: 'SCAN_STARTED'; rootPath: string; scanId: string }
  | { type: 'SCAN_PROGRESS'; filesFound: number }
  | { type: 'METADATA_BATCH'; photos: PhotoRecord[] }
  | { type: 'SCAN_COMPLETE'; result: ScanCompleteEvent }
  | { type: 'SCAN_CANCELED' }
  | { type: 'SELECT_PHOTO'; path: string | null }
  | { type: 'SET_FOLDER_FILTER'; folder: string | null }
  | { type: 'SET_TAG_FILTER'; tag: string | null }
  | { type: 'PHOTO_UPSERTED'; photo: PhotoRecord }
  | { type: 'PHOTO_REMOVED'; filePath: string }

export function photoLibraryReducer(
  state: PhotoLibraryState,
  action: PhotoLibraryAction
): PhotoLibraryState {
  switch (action.type) {
    case 'FOLDERS_LOADED':
      return { ...state, folders: action.folders }
    case 'FOLDER_ADDED':
      if (state.folders.includes(action.folder)) return state
      return { ...state, folders: [...state.folders, action.folder] }
    case 'FOLDER_REMOVED': {
      const folders = state.folders.filter((f) => f !== action.folder)

      const photosByPath = new Map(state.photosByPath)
      for (const filePath of photosByPath.keys()) {
        if (isPathUnderOrEqual(filePath, action.folder)) photosByPath.delete(filePath)
      }

      const folderCounts = new Map(state.folderCounts)
      for (const folder of folderCounts.keys()) {
        if (isPathUnderOrEqual(folder, action.folder)) folderCounts.delete(folder)
      }
      const folderChildren = new Map(state.folderChildren)
      for (const folder of folderChildren.keys()) {
        if (isPathUnderOrEqual(folder, action.folder)) folderChildren.delete(folder)
      }

      const selectedFolder =
        state.selectedFolder && isPathUnderOrEqual(state.selectedFolder, action.folder)
          ? null
          : state.selectedFolder
      const selectedPath =
        state.selectedPath && isPathUnderOrEqual(state.selectedPath, action.folder)
          ? null
          : state.selectedPath

      return {
        ...state,
        folders,
        photosByPath,
        folderCounts,
        folderChildren,
        selectedFolder,
        selectedPath
      }
    }
    case 'SCAN_STARTED':
      return {
        ...state,
        rootPath: action.rootPath,
        scanId: action.scanId,
        status: 'scanning',
        filesFound: 0
      }
    case 'SCAN_PROGRESS':
      if (action.filesFound === state.filesFound) return state
      return { ...state, filesFound: action.filesFound }
    case 'METADATA_BATCH': {
      const photosByPath = new Map(state.photosByPath)
      const folderCounts = new Map(state.folderCounts)
      const folderChildren = new Map(state.folderChildren)
      for (const photo of action.photos) {
        if (state.rootPath && !photosByPath.has(photo.filePath)) {
          addPhotoToFolderTree(photo.filePath, state.rootPath, folderCounts, folderChildren)
        }
        photosByPath.set(photo.filePath, photo)
      }
      return { ...state, photosByPath, folderCounts, folderChildren }
    }
    case 'SCAN_COMPLETE':
      return {
        ...state,
        status: 'complete',
        cacheHits: state.cacheHits + action.result.cacheHits,
        errors: [...state.errors, ...action.result.errors]
      }
    case 'SCAN_CANCELED':
      return { ...state, status: 'canceled' }
    case 'SELECT_PHOTO':
      return { ...state, selectedPath: action.path }
    case 'SET_FOLDER_FILTER':
      return { ...state, selectedFolder: action.folder, selectedTag: null }
    case 'SET_TAG_FILTER':
      return { ...state, selectedTag: action.tag, selectedFolder: null }
    case 'PHOTO_UPSERTED': {
      const rootFolder = findRootFolder(action.photo.filePath, state.folders)
      const photosByPath = new Map(state.photosByPath)
      const folderCounts = new Map(state.folderCounts)
      const folderChildren = new Map(state.folderChildren)
      if (rootFolder && !photosByPath.has(action.photo.filePath)) {
        addPhotoToFolderTree(action.photo.filePath, rootFolder, folderCounts, folderChildren)
      }
      photosByPath.set(action.photo.filePath, action.photo)
      return { ...state, photosByPath, folderCounts, folderChildren }
    }
    case 'PHOTO_REMOVED': {
      if (!state.photosByPath.has(action.filePath)) return state

      const rootFolder = findRootFolder(action.filePath, state.folders)
      const photosByPath = new Map(state.photosByPath)
      photosByPath.delete(action.filePath)
      const folderCounts = new Map(state.folderCounts)
      const folderChildren = new Map(state.folderChildren)
      if (rootFolder) {
        removePhotoFromFolderTree(action.filePath, rootFolder, folderCounts, folderChildren)
      }
      const selectedPath = state.selectedPath === action.filePath ? null : state.selectedPath

      return { ...state, photosByPath, folderCounts, folderChildren, selectedPath }
    }
    default:
      return state
  }
}
