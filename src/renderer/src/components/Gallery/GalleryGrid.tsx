import {
  memo,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  useCallback,
  useMemo,
  useState
} from 'react'

import {
  ActionIcon,
  Box,
  Button,
  Center,
  EmptyState,
  Flex,
  Group,
  Pill,
  RollingNumber,
  Scroller,
  Slider,
  Stack,
  Text,
  Title,
  Tooltip
} from '@mantine/core'
import {
  IconColumns2,
  IconEye,
  IconLayoutGrid,
  IconLayoutList,
  IconLibraryPhoto,
  IconPhoto,
  IconStack2,
  IconUsers,
  IconX
} from '@tabler/icons-react'
import { Grid } from 'react-window'

import {
  DelegatedTooltip,
  FaceCropThumbnail,
  PersonDescriptionField,
  ScanProgressIndicator,
  TagDeleteButton,
  TagDescriptionField
} from '@components'
import { useGalleryGridLayout } from '@hooks'
import { useGalleryPreviewZoom } from '@hooks'
import { isUnderExcludedFolder } from '@shared/folderExclusion'
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { MAX_COMPARE_PHOTOS, MIN_COMPARE_PHOTOS } from '@state'
import {
  basename,
  buildFolderChildrenMap,
  collectFolderSectionOrder,
  dirname,
  isPathUnderOrEqual
} from '@utils'

import { GalleryFolderSections } from './GalleryFolderSections'
import { GalleryListView } from './GalleryListView'
import { type GalleryCellProps, GalleryPhotoCell } from './GalleryPhotoCell'
import { GallerySettingsMenu } from './GallerySettingsMenu'
import { GallerySortMenu } from './GallerySortMenu'

// Memoized: takes no props, so it bails out when AppLayout re-renders
// (e.g. a drag starting/ending flips its activeDrag state) and only
// re-renders when its own context subscriptions actually change.
export const GalleryGrid = memo(function GalleryGrid(): ReactElement {
  const {
    addFolder,
    visiblePhotos: photos,
    activePhotosByPath,
    state,
    selectPhoto,
    toggleSelectPhoto,
    selectPhotoRange,
    clearSelection,
    setTagDescription,
    deleteTag,
    tagCounts,
    tagViewCounts,
    folderTags,
    folderHasUntagged,
    setFolderTagFilter,
    setFolderUntaggedFilter,
    setPersonFilter,
    setPersonDescription,
    renameFile,
    openCompareTab,
    openDuplicatesTab,
    setGalleryViewMode,
    setGalleryCellWidth
  } = usePhotoLibrary()

  // Only set once the selected folder actually has subfolders — a leaf
  // folder (or "All Photos"/tag-only view) keeps the flat virtualized grid.
  const folderSections = useMemo(() => {
    if (!state.selectedFolder) return null
    const childrenOf = buildFolderChildrenMap(state.allFolderPaths)
    const hasSubfolders = (childrenOf.get(state.selectedFolder)?.size ?? 0) > 0
    if (!hasSubfolders) return null
    const sections = collectFolderSectionOrder(state.selectedFolder, childrenOf)
    // An excluded subfolder's section is skipped entirely when browsing an
    // ancestor — unless selectedFolder is itself at/under an excluded
    // folder, the "direct browse" exception (matches visiblePhotos below).
    const isViewingExcludedFolderDirectly = state.excludedFolders.some((folder) =>
      isPathUnderOrEqual(state.selectedFolder!, folder)
    )
    if (isViewingExcludedFolderDirectly) return sections
    return sections.filter((folder) => !isUnderExcludedFolder(folder, state.excludedFolders))
  }, [state.selectedFolder, state.allFolderPaths, state.excludedFolders])

  // Buckets the already folder+tag-filtered `photos` by which section folder
  // directly contains each one (not recursively) — sort order within each
  // bucket falls out of `photos`' own order for free.
  const photosBySection = useMemo(() => {
    if (!folderSections) return null
    const map = new Map<string, PhotoRecord[]>()
    for (const folder of folderSections) map.set(folder, [])
    for (const photo of photos) {
      map.get(dirname(photo.filePath))?.push(photo)
    }
    return map
  }, [folderSections, photos])

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
  } = useGalleryGridLayout({
    photoCount: photos.length,
    showFilenames: state.showFilenames,
    showViewCounts: state.showViewCounts,
    persistedCellWidth: state.galleryCellWidth,
    onCommitCellWidth: setGalleryCellWidth
  })
  const { previewTriggerHeld, previewScale } = useGalleryPreviewZoom(containerRef)

  // Lifted here (not into GalleryPhotoCell) — react-window recycles cell
  // instances, so per-cell state would leak "is renaming" onto the wrong photo.
  const [renamingPath, setRenamingPath] = useState<string | null>(null)

  // Ctrl/Cmd+click toggles selection; Shift+click extends a range from
  // selectedPath; a plain click replaces the selection with just this photo.
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

  // Stable reference so react-window doesn't re-diff every cell on an
  // unrelated re-render.
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
      showFilenames: state.showFilenames,
      showViewCounts: state.showViewCounts,
      animationsEnabled: state.galleryAnimationsEnabled
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
      state.showFilenames,
      state.showViewCounts,
      state.galleryAnimationsEnabled
    ]
  )

  // A "pure" tag view (via the Tags panel, no folder) shows the tag's own
  // name/description UI; a folder view shows the folder as the title
  // instead, since the tag there is just a filter.
  const isPureTagView = state.selectedTag !== null && state.selectedFolder === null
  // SET_PERSON_FILTER always clears selectedFolder (see the reducer), so
  // this is never combined with a folder view.
  const isPersonView = state.selectedPerson !== null
  const selectedPerson = isPersonView
    ? state.people.find((person) => person.id === state.selectedPerson)
    : undefined
  const selectedPersonName = isPersonView ? (selectedPerson?.name ?? 'Unnamed person') : null
  const personDescription = isPersonView ? (selectedPerson?.description ?? '') : ''
  const selectedPersonCoverThumbnailKey = selectedPerson?.coverPhotoPath
    ? (activePhotosByPath.get(selectedPerson.coverPhotoPath)?.thumbnailKey ?? null)
    : null

  const galleryTitle = state.untaggedFilterActive
    ? 'untagged'
    : isPureTagView
      ? `#${state.selectedTag}`
      : isPersonView
        ? selectedPersonName
        : state.selectedFolder
          ? basename(state.selectedFolder)
          : state.folders.length > 0
            ? 'All Photos'
            : null

  const tagDescription = isPureTagView ? (state.tagDescriptions.get(state.selectedTag!) ?? '') : ''

  return (
    <Flex direction="column" flex={1} miw={0} mih={0}>
      {galleryTitle && (
        <Box px="md" py="sm" miw={0} style={{ flexShrink: 0 }}>
          <Group justify="space-between" wrap="nowrap" align="center" gap="sm">
            <Group gap="sm" wrap="nowrap" align="center" flex={1} miw={0}>
              {isPersonView && selectedPersonCoverThumbnailKey && selectedPerson?.coverFaceBox && (
                <FaceCropThumbnail
                  thumbnailKey={selectedPersonCoverThumbnailKey}
                  box={selectedPerson.coverFaceBox}
                  size={64}
                  radius="md"
                />
              )}
              <Stack gap={2} flex={1} miw={0}>
                <Group gap={4} wrap="nowrap" align="center">
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
                  {isPureTagView && (
                    <Group gap={4} c="dimmed" wrap="nowrap" style={{ flexShrink: 0 }}>
                      <IconEye size={16} />
                      <RollingNumber value={tagViewCounts.get(state.selectedTag!) ?? 0} fz="sm" />
                    </Group>
                  )}
                  {isPureTagView && (
                    <TagDeleteButton
                      tag={state.selectedTag!}
                      count={tagCounts.get(state.selectedTag!) ?? 0}
                      onDelete={() => deleteTag(state.selectedTag!)}
                    />
                  )}
                  {isPersonView && (
                    <Tooltip label="Clear person filter">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => setPersonFilter(null)}
                        aria-label="Clear person filter"
                        style={{ flexShrink: 0 }}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
                {isPureTagView && (
                  <TagDescriptionField
                    description={tagDescription}
                    onSave={(description) =>
                      void setTagDescription(state.selectedTag!, description)
                    }
                  />
                )}
                {isPersonView && (
                  <PersonDescriptionField
                    description={personDescription}
                    onSave={(description) =>
                      void setPersonDescription(state.selectedPerson!, description)
                    }
                  />
                )}
              </Stack>
            </Group>
            <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
              {state.selectedPaths.size > 0 && (
                <>
                  <Text size="sm" c="dimmed">
                    {state.selectedPaths.size} selected
                  </Text>
                  <Tooltip label="Clear selection">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => clearSelection()}
                      aria-label="Clear selection"
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Tooltip>
                  {state.selectedPaths.size >= MIN_COMPARE_PHOTOS &&
                    state.selectedPaths.size <= MAX_COMPARE_PHOTOS && (
                      <Tooltip label="Compare photos">
                        <ActionIcon
                          variant="default"
                          ml="xs"
                          aria-label="Compare photos"
                          onClick={() => openCompareTab(Array.from(state.selectedPaths))}
                        >
                          <IconColumns2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                </>
              )}
              <Tooltip label="Show duplicate photos">
                <ActionIcon
                  variant="default"
                  aria-label="Show duplicate photos"
                  onClick={openDuplicatesTab}
                >
                  <IconStack2 size={16} />
                </ActionIcon>
              </Tooltip>
              <GallerySortMenu />
              <GallerySettingsMenu />
              <ActionIcon.Group>
                <Tooltip label="Grid view">
                  <ActionIcon
                    variant={state.galleryViewMode === 'grid' ? 'filled' : 'default'}
                    aria-label="Grid view"
                    onClick={() => setGalleryViewMode('grid')}
                  >
                    <IconLayoutGrid size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="List view">
                  <ActionIcon
                    variant={state.galleryViewMode === 'list' ? 'filled' : 'default'}
                    aria-label="List view"
                    onClick={() => setGalleryViewMode('list')}
                  >
                    <IconLayoutList size={16} />
                  </ActionIcon>
                </Tooltip>
              </ActionIcon.Group>
            </Group>
          </Group>
          {state.selectedFolder && (folderTags.length > 0 || folderHasUntagged) && (
            <Scroller mt="xs">
              <Pill.Group style={{ flexWrap: 'nowrap' }}>
                {folderHasUntagged && (
                  <Pill
                    onClick={() => setFolderUntaggedFilter(!state.untaggedFilterActive)}
                    bg={
                      state.untaggedFilterActive
                        ? 'var(--mantine-color-red-filled)'
                        : 'var(--mantine-color-red-light)'
                    }
                    c={state.untaggedFilterActive ? 'var(--mantine-color-white)' : undefined}
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                  >
                    untagged
                  </Pill>
                )}
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
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                    >
                      {tag}
                    </Pill>
                  )
                })}
              </Pill.Group>
            </Scroller>
          )}
        </Box>
      )}
      <Box
        ref={containerRef}
        flex={1}
        miw={0}
        style={{ overflow: 'hidden' }}
        onClick={(event) => {
          // Only clears on a direct click here (not bubbled from a
          // thumbnail) — the usual "click empty space to deselect" convention.
          if (event.target === event.currentTarget) clearSelection()
        }}
      >
        {photos.length === 0 ? (
          <Center h="100%">
            {state.status === 'scanning' ? (
              <ScanProgressIndicator percent={null} label="Scanning for photos…" />
            ) : state.selectedPerson ? (
              <Box
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <EmptyState
                  icon={<IconUsers size={32} />}
                  title="No photos for this person"
                  description="This person doesn't have any matching photos in your library right now."
                >
                  <EmptyState.Actions>
                    <Button variant="default" onClick={() => setPersonFilter(null)}>
                      Clear filter
                    </Button>
                  </EmptyState.Actions>
                </EmptyState>
              </Box>
            ) : (
              <Box
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <EmptyState
                  icon={<IconLibraryPhoto size={32} />}
                  title="No photos yet"
                  description="Add a folder to start building your library."
                >
                  <EmptyState.Actions>
                    <Button onClick={() => void addFolder()}>Add Folder</Button>
                  </EmptyState.Actions>
                </EmptyState>
              </Box>
            )}
          </Center>
        ) : state.galleryViewMode === 'list' ? (
          <GalleryListView photos={photos} />
        ) : folderSections && photosBySection ? (
          <GalleryFolderSections
            {...cellProps}
            rootFolder={state.selectedFolder!}
            sections={folderSections}
            photosBySection={photosBySection}
            cellHeight={cellHeight}
            width={size.width}
            height={size.height}
          />
        ) : (
          // Pinned to the debounced size (not 100%) — react-window's Grid
          // measures this wrapper on every frame, so a fluid width would
          // otherwise track the AppShell panel's live CSS transition frame
          // by frame regardless of useGalleryGridLayout's own debounce.
          <Box style={{ width: size.width, height: size.height }}>
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
          </Box>
        )}
      </Box>
      <DelegatedTooltip containerRef={containerRef} />
      {photos.length > 0 && state.galleryViewMode === 'grid' && (
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
})
