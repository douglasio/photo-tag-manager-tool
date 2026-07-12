import {
  Box,
  Center,
  Flex,
  Group,
  Loader,
  Slider,
  Text,
  Title,
  UnstyledButton
} from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Grid, type CellComponentProps } from 'react-window'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { PhotoThumbnail } from './PhotoThumbnail'
import { TagDeleteButton } from './TagDeleteButton'
import { TagDescriptionEditor } from './TagDescriptionEditor'
import { TagNameEditor } from './TagNameEditor'
import { basename } from '../utils/folderTree'
import type { PhotoRecord } from '../../../shared/types'

const DEFAULT_CELL_WIDTH = 168
// The filename label below each thumbnail takes roughly this much extra
// vertical space regardless of thumbnail size, so cell height tracks width
// with a constant offset rather than a fixed aspect ratio.
const CELL_LABEL_HEIGHT = 28
const MIN_CELL_WIDTH = 100
// Stays under thumbnailService's THUMBNAIL_LONG_EDGE (640px) so the largest
// setting still displays a natively-generated thumbnail rather than upscaling it.
const MAX_CELL_WIDTH = 600
const CELL_WIDTH_STEP = 40

function clampCellWidth(value: number): number {
  return Math.min(MAX_CELL_WIDTH, Math.max(MIN_CELL_WIDTH, value))
}

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
    <Box style={style} p={6}>
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
  const [cellWidth, setCellWidth] = useState(DEFAULT_CELL_WIDTH)
  const cellHeight = cellWidth + CELL_LABEL_HEIGHT

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

  useEffect(() => {
    window.api.getGalleryCellWidth().then((width) => {
      if (width !== null) setCellWidth(clampCellWidth(width))
    })
  }, [])

  const setCellWidthPersisted = (width: number): void => {
    const clamped = clampCellWidth(width)
    setCellWidth(clamped)
    void window.api.setGalleryCellWidth(clamped)
  }

  const columnCount = Math.max(1, Math.floor(size.width / cellWidth))
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
    <Flex direction="column" flex={1} miw={0}>
      {galleryTitle && (
        <Box px="md" py="sm" miw={0} style={{ flexShrink: 0 }}>
          {state.selectedTag ? (
            <Group gap={4} wrap="nowrap" align="center">
              <Box flex={1} miw={0}>
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
      <Box ref={containerRef} flex={1} miw={0} style={{ overflow: 'hidden' }}>
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
            columnWidth={cellWidth}
            rowCount={rowCount}
            rowHeight={cellHeight}
            defaultWidth={size.width}
            defaultHeight={size.height}
          />
        )}
      </Box>
      {photos.length > 0 && (
        <Group gap="xs" wrap="nowrap" justify="flex-end" px="md" py="xs" style={{ flexShrink: 0 }}>
          <UnstyledButton
            p={4}
            style={{ flexShrink: 0, display: 'flex' }}
            onClick={() => setCellWidthPersisted(cellWidth - CELL_WIDTH_STEP)}
            aria-label="Decrease thumbnail size"
          >
            <IconPhoto size={12} />
          </UnstyledButton>
          <Slider
            value={cellWidth}
            onChange={setCellWidth}
            onChangeEnd={setCellWidthPersisted}
            min={MIN_CELL_WIDTH}
            max={MAX_CELL_WIDTH}
            step={4}
            label={null}
            w={120}
          />
          <UnstyledButton
            p={4}
            style={{ flexShrink: 0, display: 'flex' }}
            onClick={() => setCellWidthPersisted(cellWidth + CELL_WIDTH_STEP)}
            aria-label="Increase thumbnail size"
          >
            <IconPhoto size={22} />
          </UnstyledButton>
        </Group>
      )}
    </Flex>
  )
}
