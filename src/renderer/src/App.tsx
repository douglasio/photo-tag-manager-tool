import { useEffect, useState } from 'react'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type Modifier,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { arrayMove, horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { getEventCoordinates } from '@dnd-kit/utilities'
import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Center,
  Divider,
  Group,
  Image,
  Loader,
  Scroller,
  Tabs,
  Text,
  Title,
  Tooltip
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconColumns2,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconLibraryPhoto,
  IconPhoto,
  IconX
} from '@tabler/icons-react'

import { radiusSize } from '@renderer/theme'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'

import { CompareView } from './components/Compare/CompareView'
import { DetailPanel } from './components/DetailPanel/DetailPanel'
import { AllPhotosRow } from './components/Folders/AllPhotosRow'
import { FolderSettingsMenu } from './components/Folders/FolderSettingsMenu'
import { FolderTree } from './components/Folders/FolderTree'
import { GalleryGrid } from './components/Gallery/GalleryGrid'
import { PhotoView } from './components/PhotoView/PhotoView'
import { ScanProgressBar } from './components/Settings/ScanProgressBar'
import { SettingsModal } from './components/Settings/SettingsModal'
import { AppLogo } from './components/Shared/AppLogo'
import { PanelSection } from './components/Shared/PanelSection'
import { SortableTab } from './components/Shared/SortableTab'
import { CompareTabLabel, TabLabel } from './components/Shared/TabLabel'
import { TagPanel } from './components/Tags/TagPanel'
import { PhotoLibraryProvider, usePhotoLibrary } from './state/PhotoLibraryContext'

// True while focus is inside anything the "g" shortcut below shouldn't
// hijack a keystroke from (text/date inputs, contenteditable, etc.).
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

const HEADER_HEIGHT = 52
const DRAG_PREVIEW_SIZE = 64
const DRAG_PREVIEW_OFFSET_X = 0
const DRAG_PREVIEW_OFFSET_Y = 0

// dnd-kit's official recipe for snapping the overlay to be centered directly under the pointer, using draggingNodeRect (the overlay's own measured rect) rather than the original dragged element's rect.
const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (draggingNodeRect && activatorEvent) {
    const activatorCoordinates = getEventCoordinates(activatorEvent)
    if (!activatorCoordinates) return transform
    const offsetX = activatorCoordinates.x - draggingNodeRect.left
    const offsetY = activatorCoordinates.y - draggingNodeRect.top
    return {
      ...transform,
      x: transform.x + offsetX - draggingNodeRect.width / 2 + DRAG_PREVIEW_OFFSET_X,
      y: transform.y + offsetY - draggingNodeRect.height / 2 + DRAG_PREVIEW_OFFSET_Y
    }
  }
  return transform
}

// The DragOverlay ghost that follows the cursor while a gallery thumbnail is being dragged onto a tag
function DragPreview({ photo, count }: { photo: PhotoRecord; count: number }): React.JSX.Element {
  return (
    <Box pos="relative" w={DRAG_PREVIEW_SIZE} h={DRAG_PREVIEW_SIZE}>
      <Box
        w={DRAG_PREVIEW_SIZE}
        h={DRAG_PREVIEW_SIZE}
        opacity={0.75}
        bdrs={radiusSize}
        style={{
          overflow: 'hidden',
          boxShadow: 'var(--mantine-shadow-md)',
          cursor: 'grabbing'
        }}
      >
        {photo.thumbnailStatus === 'ready' && photo.thumbnailKey ? (
          <Image
            src={toThumbProtocolUrl(photo.thumbnailKey)}
            w={DRAG_PREVIEW_SIZE}
            h={DRAG_PREVIEW_SIZE}
            fit="cover"
          />
        ) : (
          <Center w={DRAG_PREVIEW_SIZE} h={DRAG_PREVIEW_SIZE} bg="var(--mantine-color-default)">
            <IconPhoto />
          </Center>
        )}
      </Box>
      {count > 1 && (
        <Badge
          circle
          size="lg"
          variant="filled"
          pos="absolute"
          top={-8}
          right={-8}
          style={{ pointerEvents: 'none' }}
        >
          {count}
        </Badge>
      )}
    </Box>
  )
}

// Split out from App so it can call usePhotoLibrary — a component can't read
// a context it also renders the Provider for in the same function.
function AppLayout(): React.JSX.Element {
  const {
    state,
    openTabEntries,
    closePhotoTab,
    setActiveTab,
    addTagsToPhotos,
    movePhotosToFolder,
    setDetailsPanelCollapsed,
    reorderPhotoTabs
  } = usePhotoLibrary()
  const hasTabs = state.openTabs.length > 0
  // The navbar (Tags/Folders) only hides while an actual photo tab is active — switching back to the Gallery tab (with other photo tabs still open in the background) restores it. The details aside is independent of this: it's user-togglable and persisted, shown on both the gallery and photo-view screens.
  const isPhotoTabActive = state.activeTab !== 'gallery'
  // Compare View always hides the details panel outright
  const isCompareTabActive = state.compareTabs.has(state.activeTab)

  // Universal "back to gallery" shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'g' || event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableTarget(event.target)) return
      setActiveTab('gallery')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setActiveTab])

  // Alt+Left/Right cycles between open tabs
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
      if (isEditableTarget(event.target)) return
      const order = ['gallery', ...state.openTabs]
      const currentIndex = order.indexOf(state.activeTab)
      if (currentIndex === -1) return
      const nextIndex = event.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1
      if (nextIndex < 0 || nextIndex >= order.length) return
      event.preventDefault()
      setActiveTab(order[nextIndex])
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.openTabs, state.activeTab, setActiveTab])

  const [activeDragPaths, setActiveDragPaths] = useState<string[] | null>(null)
  const sensors = useSensors(
    // Requires a small pointer move before a drag "starts," so an ordinary
    // click (select, rename, etc.) is never mistaken for a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragStart = (event: DragStartEvent): void => {
    const paths = (event.active.data.current as { paths?: string[] } | undefined)?.paths
    setActiveDragPaths(paths && paths.length > 0 ? paths : [String(event.active.id)])
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveDragPaths(null)
    const { active, over } = event
    if (!over) return
    const overData = over.data.current as { tag?: string; folderPath?: string } | undefined
    const paths = (active.data.current as { paths?: string[] } | undefined)?.paths
    if (!paths || paths.length === 0) return

    if (overData?.folderPath) {
      void movePhotosToFolder(paths, overData.folderPath)
      return
    }

    const tag = overData?.tag
    if (!tag) return
    void addTagsToPhotos([tag], paths).then(() => {
      notifications.show({
        color: 'teal',
        message: `Added #${tag} to ${paths.length} photo${paths.length === 1 ? '' : 's'}`
      })
    })
  }

  const activeDragPhoto = activeDragPaths ? state.photosByPath.get(activeDragPaths[0]) : undefined

  // DndContext scoped to just the photo-tab row
  const tabSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const handleTabDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = state.openTabs.indexOf(String(active.id))
    const newIndex = state.openTabs.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    reorderPhotoTabs(arrayMove(state.openTabs, oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragPaths(null)}
    >
      <AppShell
        header={{ height: HEADER_HEIGHT }}
        navbar={{
          width: 260,
          breakpoint: 0,
          collapsed: { desktop: isPhotoTabActive, mobile: isPhotoTabActive }
        }}
        aside={{
          width: 320,
          breakpoint: 0,
          collapsed: {
            desktop: state.detailsPanelCollapsed || isCompareTabActive,
            mobile: state.detailsPanelCollapsed || isCompareTabActive
          }
        }}
        padding={0}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
              <AppLogo />
              <Title order={1} size="h5">
                Tag Me
              </Title>
            </Group>
            <Group gap="md" wrap="nowrap">
              <ScanProgressBar />
              <Tooltip
                label={
                  isCompareTabActive
                    ? 'Not available in Compare View'
                    : state.detailsPanelCollapsed
                      ? 'Show details panel'
                      : 'Hide details panel'
                }
              >
                <ActionIcon
                  variant="subtle"
                  aria-label="Toggle details panel"
                  disabled={isCompareTabActive}
                  onClick={() => setDetailsPanelCollapsed(!state.detailsPanelCollapsed)}
                >
                  {state.detailsPanelCollapsed || isCompareTabActive ? (
                    <IconLayoutSidebarRightExpand size={18} />
                  ) : (
                    <IconLayoutSidebarRightCollapse size={18} />
                  )}
                </ActionIcon>
              </Tooltip>
              <SettingsModal />
            </Group>
          </Group>
        </AppShell.Header>
        <AppShell.Navbar display="flex" style={{ flexDirection: 'column' }}>
          <Box p="md" style={{ flexShrink: 0 }}>
            <AllPhotosRow />
          </Box>
          <Divider />
          <PanelSection title="Tags">
            <TagPanel />
          </PanelSection>
          <Divider />
          <PanelSection title="Folders" headerAction={<FolderSettingsMenu />}>
            <FolderTree />
          </PanelSection>
        </AppShell.Navbar>
        <AppShell.Main>
          <Box
            h={`calc(100dvh - ${HEADER_HEIGHT}px)`}
            display="flex"
            style={{ flexDirection: 'column' }}
          >
            {hasTabs ? (
              <Tabs
                value={state.activeTab}
                onChange={(value) => value && setActiveTab(value)}
                display="flex"
                flex={1}
                mih={0}
                style={{ flexDirection: 'column' }}
              >
                <Tabs.List style={{ flexShrink: 0, flexWrap: 'nowrap' }}>
                  <Scroller>
                    <Tabs.Tab value="gallery" leftSection={<IconLibraryPhoto />}>
                      Gallery
                    </Tabs.Tab>
                    <DndContext
                      sensors={tabSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleTabDragEnd}
                    >
                      <SortableContext
                        items={state.openTabs}
                        strategy={horizontalListSortingStrategy}
                      >
                        {openTabEntries.map((entry) => (
                          <SortableTab
                            key={entry.id}
                            id={entry.id}
                            value={entry.id}
                            leftSection={
                              entry.kind === 'compare' ? <IconColumns2 size={14} /> : undefined
                            }
                            rightSection={
                              <ActionIcon
                                component="span"
                                size="xs"
                                variant="subtle"
                                color="gray"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  closePhotoTab(entry.id)
                                }}
                              >
                                <IconX size={12} />
                              </ActionIcon>
                            }
                          >
                            {entry.kind === 'compare' ? (
                              <CompareTabLabel
                                fileNames={entry.photos.map((photo) => photo.fileName)}
                              />
                            ) : (
                              <TabLabel fileName={entry.photo.fileName} />
                            )}
                          </SortableTab>
                        ))}
                      </SortableContext>
                    </DndContext>
                  </Scroller>
                </Tabs.List>
                <Tabs.Panel value="gallery" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                  <GalleryGrid />
                </Tabs.Panel>
                {openTabEntries.map((entry) => (
                  <Tabs.Panel
                    key={entry.id}
                    value={entry.id}
                    style={{ flex: 1, minHeight: 0, display: 'flex' }}
                  >
                    {entry.kind === 'compare' ? (
                      <CompareView id={entry.id} photos={entry.photos} />
                    ) : (
                      <PhotoView photo={entry.photo} />
                    )}
                  </Tabs.Panel>
                ))}
              </Tabs>
            ) : (
              <GalleryGrid />
            )}
          </Box>
        </AppShell.Main>
        <AppShell.Aside p="md" style={{ overflowY: 'auto' }}>
          <DetailPanel />
        </AppShell.Aside>
      </AppShell>
      <DragOverlay
        modifiers={[snapCenterToCursor]}
        style={{ width: DRAG_PREVIEW_SIZE, height: DRAG_PREVIEW_SIZE }}
      >
        {activeDragPhoto && (
          <DragPreview photo={activeDragPhoto} count={activeDragPaths?.length ?? 1} />
        )}
      </DragOverlay>
    </DndContext>
  )
}

// Shown until every watched folder's initial scan resolves, instead of the gallery appearing empty and filling in photo-by-photo as the sync job runs.
function StartupLoadingScreen(): React.JSX.Element {
  return (
    <Center h="100vh">
      <Group gap="xs">
        <Loader size="sm" />
        <Text c="dimmed">Loading your library…</Text>
      </Group>
    </Center>
  )
}

// Reads context to decide between the two screens above — kept separate from AppLayout so that component's hooks (keyboard shortcuts, drag sensors, etc.) are never conditionally skipped, which switching on a value inside AppLayout itself would do once initialLoadComplete flips partway through its lifetime.
function AppGate(): React.JSX.Element {
  const { state } = usePhotoLibrary()
  return state.initialLoadComplete ? <AppLayout /> : <StartupLoadingScreen />
}

function App(): React.JSX.Element {
  return (
    <PhotoLibraryProvider>
      <AppGate />
    </PhotoLibraryProvider>
  )
}

export default App
