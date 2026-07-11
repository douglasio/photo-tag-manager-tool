import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'

export function ScanProgressBar(): ReactElement | null {
  const { state, cancelScan } = usePhotoLibrary()

  if (state.status === 'idle') return null

  const processed = state.photosByPath.size
  const total = state.filesFound

  return (
    <div className="scan-progress">
      {state.status === 'scanning' && (
        <>
          <span>
            Scanning… {processed} / {total || '…'} found
          </span>
          <button type="button" onClick={() => void cancelScan()}>
            Cancel
          </button>
        </>
      )}
      {state.status === 'complete' && (
        <span>
          Done — {total} photos ({state.cacheHits} from cache)
          {state.errors.length > 0 && `, ${state.errors.length} error(s)`}
        </span>
      )}
      {state.status === 'canceled' && <span>Scan canceled ({processed} loaded)</span>}
    </div>
  )
}
