import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'

export function FolderPicker(): ReactElement {
  const { pickFolderAndScan, state } = usePhotoLibrary()

  return (
    <div className="folder-picker">
      <button
        type="button"
        onClick={() => void pickFolderAndScan()}
        disabled={state.status === 'scanning'}
      >
        Select Folder…
      </button>
      {state.rootPath && <span className="folder-picker__path">{state.rootPath}</span>}
    </div>
  )
}
