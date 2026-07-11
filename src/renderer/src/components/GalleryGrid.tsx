import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Grid, type CellComponentProps } from 'react-window'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { PhotoThumbnail } from './PhotoThumbnail'
import type { PhotoRecord } from '../../../shared/types'

const CELL_WIDTH = 168
const CELL_HEIGHT = 196

interface CellProps {
  photos: PhotoRecord[]
  columnCount: number
  selectedPath: string | null
  onSelect: (path: string) => void
}

function PhotoCell({
  columnIndex,
  rowIndex,
  style,
  photos,
  columnCount,
  selectedPath,
  onSelect
}: CellComponentProps<CellProps>): ReactElement {
  const index = rowIndex * columnCount + columnIndex
  const photo = photos[index]
  if (!photo) return <div style={style} />
  return (
    <div style={style} className="gallery-cell">
      <PhotoThumbnail
        photo={photo}
        selected={photo.filePath === selectedPath}
        onSelect={onSelect}
      />
    </div>
  )
}

export function GalleryGrid(): ReactElement {
  const { photos, state, selectPhoto } = usePhotoLibrary()
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const columnCount = Math.max(1, Math.floor(size.width / CELL_WIDTH))
  const rowCount = Math.ceil(photos.length / columnCount)

  if (photos.length === 0) {
    return (
      <div ref={containerRef} className="gallery-grid-container gallery-grid-container--empty">
        {state.status === 'scanning'
          ? 'Scanning for photos…'
          : 'No photos yet. Select a folder to begin.'}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="gallery-grid-container">
      <Grid<CellProps>
        cellComponent={PhotoCell}
        cellProps={{ photos, columnCount, selectedPath: state.selectedPath, onSelect: selectPhoto }}
        columnCount={columnCount}
        columnWidth={CELL_WIDTH}
        rowCount={rowCount}
        rowHeight={CELL_HEIGHT}
        defaultWidth={size.width}
        defaultHeight={size.height}
      />
    </div>
  )
}
