import {
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  useCallback,
  useMemo,
  useRef
} from 'react'

import { Box, Center, Text } from '@mantine/core'
import { List, useDynamicRowHeight } from 'react-window'

import { useGalleryPreviewZoom } from '@hooks'
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'

import { GalleryListRow, type GalleryListRowProps } from './GalleryListRow'

// Rows wrap variable content (comment/tags), so height is measured per-row
// via react-window's dynamic-row-height support rather than a fixed size.
const DEFAULT_ROW_HEIGHT = 180

interface GalleryListViewProps {
  photos: PhotoRecord[]
}

// One-row-per-photo alternative to GalleryGrid's virtualized thumbnail grid
// — takes an explicit `photos` array (not tied to the main gallery's
// filtered visiblePhotos) so it's reusable for any collection of photos, not
// just the primary Gallery view. Selection/preview still go through the
// shared PhotoLibraryContext, same as the grid; rows themselves are
// read-only (open a photo to edit it).
export function GalleryListView({ photos }: GalleryListViewProps): ReactElement {
  const { state, selectPhoto, toggleSelectPhoto, selectPhotoRange, clearSelection } =
    usePhotoLibrary()

  const containerRef = useRef<HTMLDivElement>(null)
  const { previewTriggerHeld, previewScale } = useGalleryPreviewZoom(containerRef)
  const rowHeight = useDynamicRowHeight({ defaultRowHeight: DEFAULT_ROW_HEIGHT })

  const handleSelect = useCallback(
    (path: string, event: ReactMouseEvent): void => {
      if (event.shiftKey) {
        selectPhotoRange(path)
      } else if (event.ctrlKey || event.metaKey) {
        toggleSelectPhoto(path)
      } else if (state.selectedPath === path && state.selectedPaths.size === 1) {
        selectPhoto(null)
      } else {
        selectPhoto(path)
      }
    },
    [selectPhoto, toggleSelectPhoto, selectPhotoRange, state.selectedPath, state.selectedPaths]
  )

  const rowProps: GalleryListRowProps = useMemo(
    () => ({
      photos,
      selectedPath: state.selectedPath,
      selectedPaths: state.selectedPaths,
      onSelect: handleSelect,
      previewTriggerHeld,
      previewScale,
      animationsEnabled: state.galleryAnimationsEnabled
    }),
    [
      photos,
      state.selectedPath,
      state.selectedPaths,
      handleSelect,
      previewTriggerHeld,
      previewScale,
      state.galleryAnimationsEnabled
    ]
  )

  if (photos.length === 0) {
    return (
      <Center h="100%">
        <Text c="dimmed">No photos to show.</Text>
      </Center>
    )
  }

  return (
    <Box
      ref={containerRef}
      flex={1}
      miw={0}
      h="100%"
      onClick={(event) => {
        // Only clears on a direct click here (not bubbled from a row) — same
        // "click empty space to deselect" convention as GalleryGrid.
        if (event.target === event.currentTarget) clearSelection()
      }}
    >
      <List<GalleryListRowProps>
        rowComponent={GalleryListRow}
        rowProps={rowProps}
        rowCount={photos.length}
        rowHeight={rowHeight}
        rowKey={(index, data) => data.photos[index]?.filePath ?? index}
        style={{ height: '100%', width: '100%' }}
      />
    </Box>
  )
}
