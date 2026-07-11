import type { ReactElement } from 'react'
import type { PhotoRecord } from '../../../shared/types'
import { toThumbProtocolUrl } from '../../../shared/protocolUrls'

interface PhotoThumbnailProps {
  photo: PhotoRecord
  selected: boolean
  onSelect: (path: string) => void
}

export function PhotoThumbnail({ photo, selected, onSelect }: PhotoThumbnailProps): ReactElement {
  return (
    <button
      type="button"
      className={`photo-thumbnail${selected ? ' photo-thumbnail--selected' : ''}`}
      onClick={() => onSelect(photo.filePath)}
      title={photo.fileName}
    >
      {photo.thumbnailStatus === 'ready' && photo.thumbnailKey ? (
        <img src={toThumbProtocolUrl(photo.thumbnailKey)} alt={photo.fileName} loading="lazy" />
      ) : (
        <div className="photo-thumbnail__placeholder">
          {photo.thumbnailStatus === 'error' ? '⚠︎' : '…'}
        </div>
      )}
      <span className="photo-thumbnail__name">{photo.fileName}</span>
    </button>
  )
}
