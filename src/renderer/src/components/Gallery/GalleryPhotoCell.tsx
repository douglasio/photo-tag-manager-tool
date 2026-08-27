import { memo, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react'

import { Box } from '@mantine/core'
import type { CellComponentProps } from 'react-window'

import type { PhotoRecord } from '@shared/types'

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
  previewTriggerHeld: boolean
  previewScale: number
  showFilenames: boolean
  showViewCounts: boolean
  animationsEnabled: boolean
}

export interface GalleryThumbnailCellProps {
  photo: PhotoRecord
  selectedPath: string | null
  selectedPaths: Set<string>
  onSelect: (path: string, event: ReactMouseEvent) => void
  renamingPath: string | null
  onStartRename: (path: string) => void
  onStopRename: () => void
  onRename: (filePath: string, newBaseName: string) => Promise<void>
  previewTriggerHeld: boolean
  previewScale: number
  showFilenames: boolean
  showViewCounts: boolean
  animationsEnabled: boolean
}

// Shared by both the virtualized GalleryPhotoCell below and the
// non-virtualized per-subfolder sections (GalleryFolderSections).
export function GalleryThumbnailCell({
  photo,
  selectedPath,
  selectedPaths,
  onSelect,
  renamingPath,
  onStartRename,
  onStopRename,
  onRename,
  previewTriggerHeld,
  previewScale,
  showFilenames,
  showViewCounts,
  animationsEnabled
}: GalleryThumbnailCellProps): ReactElement {
  return (
    <PhotoContextMenu photo={photo} onRename={() => onStartRename(photo.filePath)}>
      <PhotoThumbnail
        photo={photo}
        selected={photo.filePath === selectedPath}
        multiSelected={selectedPaths.has(photo.filePath)}
        selectedPaths={selectedPaths}
        animationsEnabled={animationsEnabled}
        onSelect={onSelect}
        renaming={renamingPath === photo.filePath}
        onStartRename={() => onStartRename(photo.filePath)}
        onStopRename={onStopRename}
        onRename={(newBaseName) => onRename(photo.filePath, newBaseName)}
        previewTriggerHeld={previewTriggerHeld}
        previewScale={previewScale}
        showFilename={showFilenames}
        showViewCount={showViewCounts}
      />
    </PhotoContextMenu>
  )
}

// custom memoization for cells whose actual rendered output wouldn't change on a thumbnail select
function cellPropsAreEqual(
  prev: CellComponentProps<GalleryCellProps>,
  next: CellComponentProps<GalleryCellProps>
): boolean {
  if (
    prev.rowIndex !== next.rowIndex ||
    prev.columnIndex !== next.columnIndex ||
    prev.columnCount !== next.columnCount ||
    prev.onSelect !== next.onSelect ||
    prev.onStartRename !== next.onStartRename ||
    prev.onStopRename !== next.onStopRename ||
    prev.onRename !== next.onRename ||
    prev.previewTriggerHeld !== next.previewTriggerHeld ||
    prev.previewScale !== next.previewScale ||
    prev.showFilenames !== next.showFilenames ||
    prev.showViewCounts !== next.showViewCounts ||
    prev.animationsEnabled !== next.animationsEnabled ||
    prev.style.transform !== next.style.transform ||
    prev.style.width !== next.style.width ||
    prev.style.height !== next.style.height
  ) {
    return false
  }

  // Compare this cell's own photo, not the array's identity — a metadata
  // batch or single-photo write (tag edit, view-count bump) replaces the
  // array every time, but only the affected cells' photo objects change.
  const index = prev.rowIndex * prev.columnCount + prev.columnIndex
  const photo = prev.photos[index]
  if (photo !== next.photos[index]) return false
  const filePath = photo?.filePath

  const inPrevSelection = filePath !== undefined && prev.selectedPaths.has(filePath)
  const inNextSelection = filePath !== undefined && next.selectedPaths.has(filePath)
  // A cell that stays in a changed multi-selection must still re-render:
  // its drag payload (PhotoThumbnail's dragPaths) carries the whole set.
  if (inPrevSelection && inNextSelection && prev.selectedPaths !== next.selectedPaths) return false

  return (
    (filePath === prev.selectedPath) === (filePath === next.selectedPath) &&
    inPrevSelection === inNextSelection &&
    (filePath === prev.renamingPath) === (filePath === next.renamingPath)
  )
}

function GalleryPhotoCellImpl({
  columnIndex,
  rowIndex,
  style,
  photos,
  columnCount,
  ...rest
}: CellComponentProps<GalleryCellProps>): ReactElement {
  const index = rowIndex * columnCount + columnIndex
  const photo = photos[index]
  if (!photo) return <div style={style} />
  return (
    <Box style={style} p={6}>
      <GalleryThumbnailCell photo={photo} {...rest} />
    </Box>
  )
}

// react-window's cellComponent type expects a plain function component, not
// a MemoExoticComponent — cast back to that shape rather than widening the
// prop type everywhere just to satisfy memo()'s broader ReactNode return.
/** react-window cell renderer for GalleryGrid — one photo thumbnail per cell. */
export const GalleryPhotoCell = memo(GalleryPhotoCellImpl, cellPropsAreEqual) as unknown as (
  props: CellComponentProps<GalleryCellProps>
) => ReactElement
