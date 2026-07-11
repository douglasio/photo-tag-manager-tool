import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { TagList } from './TagList'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

export function DetailPanel(): ReactElement {
  const { selectedPhoto } = usePhotoLibrary()

  if (!selectedPhoto) {
    return <div className="detail-panel detail-panel--empty">Select a photo to see its details</div>
  }

  const { metadata } = selectedPhoto

  return (
    <div className="detail-panel">
      <h2 className="detail-panel__title">{selectedPhoto.fileName}</h2>

      <section>
        <h3>Tags</h3>
        <TagList tags={selectedPhoto.tags} />
      </section>

      <section>
        <h3>Metadata</h3>
        <dl className="detail-panel__metadata">
          <dt>Date taken</dt>
          <dd>{metadata.dateTaken ?? '—'}</dd>
          <dt>Camera</dt>
          <dd>{[metadata.cameraMake, metadata.cameraModel].filter(Boolean).join(' ') || '—'}</dd>
          <dt>Dimensions</dt>
          <dd>
            {metadata.widthPx && metadata.heightPx
              ? `${metadata.widthPx} × ${metadata.heightPx}`
              : '—'}
          </dd>
          <dt>File size</dt>
          <dd>{formatBytes(metadata.fileSizeBytes)}</dd>
          <dt>Format</dt>
          <dd>{metadata.format}</dd>
          <dt>Path</dt>
          <dd className="detail-panel__path">{selectedPhoto.filePath}</dd>
        </dl>
      </section>
    </div>
  )
}
