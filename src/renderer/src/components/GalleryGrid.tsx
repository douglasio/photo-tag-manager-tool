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
import { useCtrlKeyHeld } from '../hooks/useCtrlKeyHeld'
import { PhotoContextMenu } from './PhotoContextMenu'
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
const MIN_PREVIEW_SCALE = 0.5
const MAX_PREVIEW_SCALE = 3
// A typical wheel "notch" reports a deltaY of roughly 100, so this yields
// about a 0.15x change per notch — noticeable without feeling twitchy.
const PREVIEW_ZOOM_SENSITIVITY = 0.0015

function clampCellWidth(value: number): number {
  return Math.min(MAX_CELL_WIDTH, Math.max(MIN_CELL_WIDTH, value))
}

// Evenly spaced tick marks spanning the slider's actual min/max range, so
// they land at real, reachable cell-width values rather than arbitrary points.
const SIZE_MARK_COUNT = 5
const SIZE_MARK_VALUES = Array.from(
  { length: SIZE_MARK_COUNT },
  (_, index) => MIN_CELL_WIDTH + ((MAX_CELL_WIDTH - MIN_CELL_WIDTH) * index) / (SIZE_MARK_COUNT - 1)
)
const SIZE_MARKS = SIZE_MARK_VALUES.map((value) => ({ value }))

function clampPreviewScale(value: number): number {
  return Math.min(MAX_PREVIEW_SCALE, Math.max(MIN_PREVIEW_SCALE, value))
}

interface CellProps {
  photos: PhotoRecord[]
  columnCount: number
  selectedPath: string | null
  onSelect: (path: string) => void
  renamingPath: string | null
  onStartRename: (path: string) => void
  onStopRename: () => void
  onRename: (filePath: string, newBaseName: string) => Promise<void>
  ctrlHeld: boolean
  previewScale: number
}

function PhotoCell({
  columnIndex,
  rowIndex,
  style,
  photos,
  columnCount,
  selectedPath,
  onSelect,
  renamingPath,
  onStartRename,
  onStopRename,
  onRename,
  ctrlHeld,
  previewScale
}: CellComponentProps<CellProps>): ReactElement {
  const index = rowIndex * columnCount + columnIndex
  const photo = photos[index]
  if (!photo) return <div style={style} />
  return (
    <Box style={style} p={6}>
      <PhotoContextMenu photo={photo} onRename={() => onStartRename(photo.filePath)}>
        <PhotoThumbnail
          photo={photo}
          selected={photo.filePath === selectedPath}
          onSelect={onSelect}
          renaming={renamingPath === photo.filePath}
          onStartRename={() => onStartRename(photo.filePath)}
          onStopRename={onStopRename}
          onRename={(newBaseName) => onRename(photo.filePath, newBaseName)}
          ctrlHeld={ctrlHeld}
          previewScale={previewScale}
        />
      </PhotoContextMenu>
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
    setFolderTagFilter,
    renameFile
  } = usePhotoLibrary()
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [cellWidth, setCellWidth] = useState(DEFAULT_CELL_WIDTH)
  // Lifted up here (not into PhotoCell) since react-window recycles cell
  // instances across different photos as the user scrolls — per-cell local
  // state would risk leaking "is renaming" onto the wrong photo.
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const ctrlHeld = useCtrlKeyHeld()
  // A ref mirror of ctrlHeld so the native wheel listener below (attached
  // once) always reads the latest value without needing to re-subscribe.
  const ctrlHeldRef = useRef(ctrlHeld)
  useEffect(() => {
    ctrlHeldRef.current = ctrlHeld
  }, [ctrlHeld])
  const [previewScale, setPreviewScale] = useState(1)
  // Reset the zoom once Ctrl is released, so the next Ctrl+hover session
  // starts fresh — adjusted during render (not a useEffect) per this
  // codebase's pattern for resetting state when an external value changes.
  const [wasCtrlHeld, setWasCtrlHeld] = useState(ctrlHeld)
  if (ctrlHeld !== wasCtrlHeld) {
    setWasCtrlHeld(ctrlHeld)
    if (!ctrlHeld) setPreviewScale(1)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // React's synthetic onWheel attaches its DOM listener as passive, so
    // event.preventDefault() inside it is silently ignored by the browser
    // (Chrome just logs a "preventDefault inside passive listener" warning)
    // and the grid keeps scrolling underneath the zoom. A manually attached
    // { passive: false } listener is the only way to actually cancel it.
    const handleWheel = (event: WheelEvent): void => {
      if (!ctrlHeldRef.current) return
      event.preventDefault()
      setPreviewScale((scale) => clampPreviewScale(scale - event.deltaY * PREVIEW_ZOOM_SENSITIVITY))
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

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

  // The +/- buttons jump between the slider's own SIZE_MARK_VALUES rather
  // than stepping by a fixed pixel amount, so they always land exactly on a
  // mark instead of somewhere between two of them.
  const stepToMark = (delta: number): void => {
    const closestIndex = SIZE_MARK_VALUES.reduce(
      (closest, value, index) =>
        Math.abs(value - cellWidth) < Math.abs(SIZE_MARK_VALUES[closest] - cellWidth)
          ? index
          : closest,
      0
    )
    const nextIndex = Math.min(SIZE_MARK_VALUES.length - 1, Math.max(0, closestIndex + delta))
    setCellWidthPersisted(SIZE_MARK_VALUES[nextIndex])
  }

  // Keep a stable reference so react-window doesn't re-diff every visible
  // cell whenever GalleryGrid re-renders for an unrelated reason.
  const cellProps = useMemo(
    () => ({
      photos,
      columnCount,
      selectedPath: state.selectedPath,
      onSelect: selectPhoto,
      renamingPath,
      onStartRename: setRenamingPath,
      onStopRename: () => setRenamingPath(null),
      onRename: renameFile,
      ctrlHeld,
      previewScale
    }),
    [
      photos,
      columnCount,
      state.selectedPath,
      selectPhoto,
      renamingPath,
      renameFile,
      ctrlHeld,
      previewScale
    ]
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
    // mih=0 (in addition to miw=0) is required because this component is
    // mounted as a flex item in different parent orientations depending on
    // context (a row-flex Box outside Tabs, a column-flex Tabs when photo
    // tabs are open) — without it, its main axis defaults to its content's
    // intrinsic size in a column parent, overflowing past the fixed-height
    // ancestor instead of shrinking to fit, which hides the footer and
    // breaks the internal grid's own scroll container.
    <Flex direction="column" flex={1} miw={0} mih={0}>
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
          <ActionIcon onClick={() => stepToMark(-1)} aria-label="Decrease thumbnail size">
            <IconPhoto size={12} />
          </ActionIcon>
          <Slider
            value={cellWidth}
            onChange={setCellWidth}
            onChangeEnd={setCellWidthPersisted}
            min={MIN_CELL_WIDTH}
            max={MAX_CELL_WIDTH}
            step={4}
            marks={SIZE_MARKS}
            label={null}
            w={120}
            restrictToMarks
          />
          <ActionIcon onClick={() => stepToMark(1)} aria-label="Increase thumbnail size">
            <IconPhoto size={22} />
          </ActionIcon>
        </Group>
      )}
    </Flex>
  )
}
