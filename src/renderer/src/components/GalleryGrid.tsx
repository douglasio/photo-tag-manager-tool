import { Box, Center, Group, Loader, Text, Title } from '@mantine/core'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Grid, type CellComponentProps } from 'react-window'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { PhotoThumbnail } from './PhotoThumbnail'
import { TagDeleteButton } from './TagDeleteButton'
import { TagDescriptionEditor } from './TagDescriptionEditor'
import { TagNameEditor } from './TagNameEditor'
import { basename } from '../utils/folderTree'
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
    <Box style={{ ...style, padding: 6 }}>
      <PhotoThumbnail
        photo={photo}
        selected={photo.filePath === selectedPath}
        onSelect={onSelect}
      />
    </Box>
  )
}

export function GalleryGrid(): ReactElement {
  const {
    visiblePhotos: photos,
    state,
    selectPhoto,
    setTagDescription,
    renameTag,
    deleteTag,
    tagCounts
  } = usePhotoLibrary()
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

  const galleryTitle = state.selectedTag
    ? `#${state.selectedTag}`
    : state.selectedFolder
      ? basename(state.selectedFolder)
      : state.folders.length > 0
        ? 'All Photos'
        : null

  const tagDescription = state.selectedTag
    ? (state.tagDescriptions.get(state.selectedTag) ?? '')
    : ''

  return (
    <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {galleryTitle && (
        <Box px="md" py="sm" style={{ flexShrink: 0, minWidth: 0 }}>
          {state.selectedTag ? (
            <Group gap={4} wrap="nowrap" align="center">
              <Box style={{ flex: 1, minWidth: 0 }}>
                <TagNameEditor
                  tag={state.selectedTag}
                  count={tagCounts.get(state.selectedTag) ?? 0}
                  onRename={(newTag) => renameTag(state.selectedTag!, newTag)}
                />
              </Box>
              <TagDeleteButton
                tag={state.selectedTag}
                count={tagCounts.get(state.selectedTag) ?? 0}
                onDelete={() => deleteTag(state.selectedTag!)}
              />
            </Group>
          ) : (
            <Title
              order={2}
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {galleryTitle}
            </Title>
          )}
          {state.selectedTag && (
            <TagDescriptionEditor
              description={tagDescription}
              onSave={(description) => void setTagDescription(state.selectedTag!, description)}
            />
          )}
        </Box>
      )}
      <Box ref={containerRef} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {photos.length === 0 ? (
          <Center h="100%">
            {state.status === 'scanning' ? (
              <Group gap="xs">
                <Loader />
                <Text c="dimmed">Scanning for photos…</Text>
              </Group>
            ) : (
              <Text c="dimmed">No photos yet. Add a folder to begin.</Text>
            )}
          </Center>
        ) : (
          <Grid<CellProps>
            cellComponent={PhotoCell}
            cellProps={{
              photos,
              columnCount,
              selectedPath: state.selectedPath,
              onSelect: selectPhoto
            }}
            columnCount={columnCount}
            columnWidth={CELL_WIDTH}
            rowCount={rowCount}
            rowHeight={CELL_HEIGHT}
            defaultWidth={size.width}
            defaultHeight={size.height}
          />
        )}
      </Box>
    </Box>
  )
}
