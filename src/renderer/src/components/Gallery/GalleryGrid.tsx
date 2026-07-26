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
  Title,
  Tooltip
} from '@mantine/core'
import { IconColumns2, IconPhoto, IconX } from '@tabler/icons-react'
import {
  useCallback,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement
} from 'react'
import { Grid } from 'react-window'
import { usePhotoLibrary } from '../../state/PhotoLibraryContext'
import { useGalleryGridLayout } from '../../hooks/useGalleryGridLayout'
import { useGalleryPreviewZoom } from '../../hooks/useGalleryPreviewZoom'
import { GalleryPhotoCell, type GalleryCellProps } from './GalleryPhotoCell'
import { TagDeleteButton } from '../Tags/TagDeleteButton'
import { TagDescriptionEditor } from '../Tags/TagDescriptionEditor'
import { TagNameEditor } from '../Tags/TagNameEditor'
import { basename } from '../../utils/folderTree'
import { GallerySettingsMenu } from './GallerySettingsMenu'
import { GallerySortMenu } from './GallerySortMenu'

export function GalleryGrid(): ReactElement {
  const {
    visiblePhotos: photos,
    state,
    selectPhoto,
    toggleSelectPhoto,
    selectPhotoRange,
    clearSelection,
    setTagDescription,
    renameTag,
    deleteTag,
    tagCounts,
    folderTags,
    setFolderTagFilter,
    renameFile,
    openCompareTab
  } = usePhotoLibrary()

  const {
    containerRef,
    size,
    cellWidth,
    minCellWidth,
    maxCellWidth,
    sizeMarks,
    columnCount,
    actualCellWidth,
    cellHeight,
    rowCount,
    setCellWidth,
    setCellWidthPersisted,
    stepToMark
  } = useGalleryGridLayout({ photoCount: photos.length, showFilenames: state.showFilenames })
  const { previewTriggerHeld, previewScale } = useGalleryPreviewZoom(containerRef)

  // Lifted up here (not into GalleryPhotoCell) since react-window recycles
  // cell instances across different photos as the user scrolls — per-cell
  // local state would risk leaking "is renaming" onto the wrong photo.
  const [renamingPath, setRenamingPath] = useState<string | null>(null)

  // Ctrl/Cmd+click toggles the photo in/out of the batch selection;
  // Shift+click extends a range from the current selectedPath; a plain click
  // replaces the whole selection with just this photo.
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

  // Keep a stable reference so react-window doesn't re-diff every visible
  // cell whenever GalleryGrid re-renders for an unrelated reason.
  const cellProps: GalleryCellProps = useMemo(
    () => ({
      photos,
      columnCount,
      selectedPath: state.selectedPath,
      selectedPaths: state.selectedPaths,
      onSelect: handleSelect,
      renamingPath,
      onStartRename: setRenamingPath,
      onStopRename: () => setRenamingPath(null),
      onRename: renameFile,
      previewTriggerHeld,
      previewScale,
      showFilenames: state.showFilenames
    }),
    [
      photos,
      columnCount,
      state.selectedPath,
      state.selectedPaths,
      handleSelect,
      renamingPath,
      renameFile,
      previewTriggerHeld,
      previewScale,
      state.showFilenames
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
          <Group justify="space-between" wrap="nowrap" align="center" gap="sm">
            {isPureTagView ? (
              <Group gap={4} wrap="nowrap" align="center" flex={1} miw={0}>
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
                flex={1}
                miw={0}
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {galleryTitle}
              </Title>
            )}
            <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
              {state.selectedPaths.size > 0 && (
                <>
                  <Text size="sm" c="dimmed">
                    {state.selectedPaths.size} selected
                  </Text>
                  {state.selectedPaths.size === 2 && (
                    <Tooltip label="Compare photos">
                      <ActionIcon
                        variant="subtle"
                        aria-label="Compare photos"
                        onClick={() => {
                          const [pathA, pathB] = state.selectedPaths
                          openCompareTab(pathA, pathB)
                        }}
                      >
                        <IconColumns2 size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  <Tooltip label="Clear selection">
                    <ActionIcon
                      variant="subtle"
                      onClick={clearSelection}
                      aria-label="Clear selection"
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Tooltip>
                </>
              )}
              <GallerySortMenu />
              <GallerySettingsMenu />
            </Group>
          </Group>
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
                    bg={
                      isActive
                        ? 'var(--mantine-primary-color-filled)'
                        : 'var(--mantine-primary-color-light)'
                    }
                    c={isActive ? 'var(--mantine-color-white)' : undefined}
                    style={{ cursor: 'pointer' }}
                  >
                    {tag}
                  </Pill>
                )
              })}
            </Pill.Group>
          )}
        </Box>
      )}
      <Box
        ref={containerRef}
        flex={1}
        miw={0}
        style={{ overflow: 'hidden' }}
        onClick={(event) => {
          // Only clears when the click lands directly on this empty
          // container (not bubbled up from a thumbnail), matching the usual
          // "click empty space to deselect" convention.
          if (event.target === event.currentTarget) clearSelection()
        }}
      >
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
          <Grid<GalleryCellProps>
            cellComponent={GalleryPhotoCell}
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
            min={minCellWidth}
            max={maxCellWidth}
            step={4}
            marks={sizeMarks}
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
