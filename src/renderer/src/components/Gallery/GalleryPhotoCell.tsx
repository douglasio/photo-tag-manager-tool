import { Box } from '@mantine/core'
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react'
import type { CellComponentProps } from 'react-window'
import type { PhotoRecord } from '../../../../shared/types'
import { PhotoContextMenu } from './PhotoContextMenu'
import { PhotoThumbnail } from './PhotoThumbnail'

export interface GalleryCellProps {
  photos: PhotoRecord[]
  columnCount: number
  selectedPath: string | null
  selectedPaths: Set<string>
  onSelect: (path: string, event: ReactMouseEvent) => void
  renamingPath: string | null
  onStartRename: (path: string) => void
  onStopRename: () => void
  onRename: (filePath: string, newBaseName: string) => Promise<void>
  ctrlHeld: boolean
  previewScale: number
  showFilenames: boolean
  hoveredPath: string | null
  // Separate enter/leave callbacks (rather than a single "set to this path or
  // null") avoid a race when the pointer moves directly from one thumbnail to
  // an adjacent one: the new thumbnail's enter can fire before the old one's
  // leave, and a plain "leave clears it" would wipe out the just-set hover.
  onHoverEnter: (path: string) => void
  onHoverLeave: (path: string) => void
}

/** react-window cell renderer for GalleryGrid — one photo thumbnail per cell. */
export function GalleryPhotoCell({
  columnIndex,
  rowIndex,
  style,
  photos,
  columnCount,
  selectedPath,
  selectedPaths,
  onSelect,
  renamingPath,
  onStartRename,
  onStopRename,
  onRename,
  ctrlHeld,
  previewScale,
  showFilenames,
  hoveredPath,
  onHoverEnter,
  onHoverLeave
}: CellComponentProps<GalleryCellProps>): ReactElement {
  const index = rowIndex * columnCount + columnIndex
  const photo = photos[index]
  if (!photo) return <div style={style} />
  return (
    <Box style={style} p={6}>
      <PhotoContextMenu photo={photo} onRename={() => onStartRename(photo.filePath)}>
        <PhotoThumbnail
          photo={photo}
          selected={photo.filePath === selectedPath}
          multiSelected={selectedPaths.has(photo.filePath)}
          onSelect={onSelect}
          renaming={renamingPath === photo.filePath}
          onStartRename={() => onStartRename(photo.filePath)}
          onStopRename={onStopRename}
          onRename={(newBaseName) => onRename(photo.filePath, newBaseName)}
          ctrlHeld={ctrlHeld}
          previewScale={previewScale}
          showFilename={showFilenames}
          spotlighted={hoveredPath === photo.filePath}
          dimmed={hoveredPath !== null && hoveredPath !== photo.filePath}
          onHoverEnter={() => onHoverEnter(photo.filePath)}
          onHoverLeave={() => onHoverLeave(photo.filePath)}
        />
      </PhotoContextMenu>
    </Box>
  )
}
