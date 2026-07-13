import {
  ActionIcon,
  Box,
  Center,
  Flex,
  Group,
  Loader,
  Pill,
  Slider,
  Text,
  Title
} from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
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
// react-window's Grid renders its own vertical scrollbar inside the width we
// give it, so column math needs to leave room for it — otherwise the last
// column overflows the scrollbar's width and the grid gains an unwanted
// horizontal scrollbar.
const SCROLLBAR_RESERVE_PX = 16

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
    tagCounts,
    folderTags,
    setFolderTagFilter
  } = usePhotoLibrary()
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [cellWidth, setCellWidth] = useState(DEFAULT_CELL_WIDTH)

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

  // Pick the column count closest to the target cell width, then stretch each
  // column to exactly fill the available width — avoids a leftover sliver of
  // empty space on the right that a plain floor-division would leave behind.
  const availableWidth = Math.max(size.width - SCROLLBAR_RESERVE_PX, 0)
  const columnCount = Math.max(1, Math.round(availableWidth / cellWidth))
  const actualCellWidth = availableWidth > 0 ? availableWidth / columnCount : cellWidth
  const cellHeight = actualCellWidth + CELL_LABEL_HEIGHT
  const rowCount = Math.ceil(photos.length / columnCount)

  // The +/- buttons step by whole columns rather than by CELL_WIDTH_STEP
  // pixels — near either end of the range a 40px nudge can round back to the
  // same columnCount and visibly do nothing, whereas a column-count step is
  // guaranteed to change something (until truly at the min/max clamp).
  const stepByColumns = (delta: number): void => {
    const nextColumnCount = Math.max(1, columnCount + delta)
    const nextWidth = availableWidth > 0 ? availableWidth / nextColumnCount : cellWidth
    setCellWidthPersisted(nextWidth)
  }

  // Keep a stable reference so react-window doesn't re-diff every visible
  // cell whenever GalleryGrid re-renders for an unrelated reason.
  const cellProps = useMemo(
    () => ({
      photos,
      columnCount,
      selectedPath: state.selectedPath,
      onSelect: selectPhoto
    }),
    [photos, columnCount, state.selectedPath, selectPhoto]
  )

  // A "pure" tag view (navigated via the Tags panel, no folder context) shows
  // the tag's own name/description editing UI. A folder view — with or
  // without an additional tag pill narrowing it — shows the folder as the
  // primary title instead, since the tag there is just a filter layered on top.
  const isPureTagView = state.selectedTag !== null && state.selectedFolder === null

  const galleryTitle = isPureTagView
    ? `#${state.selectedTag}`
    : state.selectedFolder
      ? basename(state.selectedFolder)
      : state.folders.length > 0
        ? 'All Photos'
        : null

  const tagDescription = isPureTagView ? (state.tagDescriptions.get(state.selectedTag!) ?? '') : ''

  return (
    <Flex direction="column" flex={1} miw={0}>
      {galleryTitle && (
        <Box px="md" py="sm" miw={0} style={{ flexShrink: 0 }}>
          {isPureTagView ? (
            <Group gap={4} wrap="nowrap" align="center">
              <Box flex={1} miw={0}>
                <TagNameEditor
                  tag={state.selectedTag!}
                  count={tagCounts.get(state.selectedTag!) ?? 0}
                  onRename={(newTag) => renameTag(state.selectedTag!, newTag)}
                />
              </Box>
              <TagDeleteButton
                tag={state.selectedTag!}
                count={tagCounts.get(state.selectedTag!) ?? 0}
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
          {isPureTagView && (
            <TagDescriptionEditor
              description={tagDescription}
              onSave={(description) => void setTagDescription(state.selectedTag!, description)}
            />
          )}
          {state.selectedFolder && folderTags.length > 0 && (
            <Pill.Group mt="xs">
              {folderTags.map((tag) => {
                const isActive = state.selectedTag === tag
                return (
                  <Pill
                    key={tag}
                    onClick={() => setFolderTagFilter(isActive ? null : tag)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isActive
                        ? 'var(--mantine-primary-color-filled)'
                        : 'var(--mantine-primary-color-light)',
                      color: isActive ? 'var(--mantine-color-white)' : undefined
                    }}
                  >
                    {tag}
                  </Pill>
                )
              })}
            </Pill.Group>
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
            cellProps={cellProps}
            columnCount={columnCount}
            columnWidth={actualCellWidth}
            rowCount={rowCount}
            rowHeight={cellHeight}
            defaultWidth={size.width}
            defaultHeight={size.height}
            style={{ overflowX: 'hidden' }}
          />
        )}
      </Box>
      {photos.length > 0 && (
        <Group gap="xs" wrap="nowrap" justify="flex-end" px="md" py="xs" style={{ flexShrink: 0 }}>
          <ActionIcon onClick={() => stepByColumns(1)} aria-label="Decrease thumbnail size">
            <IconPhoto size={12} />
          </ActionIcon>
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
          <ActionIcon onClick={() => stepByColumns(-1)} aria-label="Increase thumbnail size">
            <IconPhoto size={22} />
          </ActionIcon>
        </Group>
      )}
    </Flex>
  )
}
