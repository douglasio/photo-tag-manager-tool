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
  Kbd,
  Paper,
  Scroller,
  Tabs,
  Text,
  Title,
  Tooltip
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconColumns2,
  IconLayoutDashboard,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconLibraryPhoto,
  IconPhoto,
  IconX
} from '@tabler/icons-react'

import {
  AllPhotosRow,
  // AppLogo,
  CompareTabLabel,
  CompareView,
  DashboardView,
  DetailPanel,
  FolderSettingsMenu,
  FolderTree,
  GalleryGrid,
  PanelSection,
  PhotoView,
  ScanProgressBar,
  SettingsModal,
  SortableTab,
  StartupLoadingScreen,
  TabLabel,
  TagGroupCreateButton,
  TagPanel
} from '@components'
import { radiusSize } from '@renderer/theme'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'

import { PhotoLibraryProvider, usePhotoLibrary } from './state/PhotoLibraryContext'

// True while focus is inside anything the "g" shortcut below shouldn't
// hijack a keystroke from (text/date inputs, contenteditable, etc.).
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

// const TITLE_BAR_HEIGHT = 52
// const TAB_BAR_HEIGHT = 44
const HEADER_HEIGHT = 50
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

// The DragOverlay ghost for a tag being dragged into a group — deliberately
// much lighter than DragPreview above, no thumbnail to show.
function TagDragPreview({ tag }: { tag: string }): React.JSX.Element {
  return (
    <Paper withBorder shadow="md" px="sm" py={4} radius={radiusSize} style={{ cursor: 'grabbing' }}>
      <Text size="sm" fw={500}>
        #{tag}
      </Text>
    </Paper>
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
    reorderPhotoTabs,
    assignTagToGroup
  } = usePhotoLibrary()
  // The navbar (Tags/Folders) hides for any non-Gallery tab, including Dashboard (full-screen, no side panels) — switching back to Gallery (with other tabs still open in the background) restores it. The details aside is independent of this: it's user-togglable and persisted, shown on both the gallery and photo-view screens.
  const isPhotoTabActive = state.activeTab !== 'gallery'
  // Compare View always hides the details panel outright
  const isCompareTabActive = state.compareTabs.has(state.activeTab)
  // Dashboard is full-screen — no details panel either.
  const isDashboardTabActive = state.activeTab === 'dashboard'

  // Universal "jump to gallery" / "jump to dashboard" shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== 'g' && event.key !== 'd') return
      if (isEditableTarget(event.target)) return
      setActiveTab(event.key === 'g' ? 'gallery' : 'dashboard')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setActiveTab])

  // Alt+Left/Right cycles between open tabs
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
      if (isEditableTarget(event.target)) return
      const order = ['dashboard', 'gallery', ...state.openTabs]
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

  // Two independent drag domains share this one DndContext (tags can't move
  // to a second, nested context scoped to the tag panel without shadowing
  // their existing useDroppable — see the tag-drag branch below) — 'photo'
  // is the original dragged-thumbnail-onto-tag/folder flow, 'tag' is a tag
  // being dragged into a group.
  const [activeDrag, setActiveDrag] = useState<
    { kind: 'photo'; paths: string[] } | { kind: 'tag'; tag: string } | null
  >(null)
  const sensors = useSensors(
    // Requires a small pointer move before a drag "starts," so an ordinary
    // click (select, rename, etc.) is never mistaken for a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragStart = (event: DragStartEvent): void => {
    const data = event.active.data.current as { paths?: string[]; tag?: string } | undefined
    if (data?.tag) {
      setActiveDrag({ kind: 'tag', tag: data.tag })
      return
    }
    const paths = data?.paths
    setActiveDrag({
      kind: 'photo',
      paths: paths && paths.length > 0 ? paths : [String(event.active.id)]
    })
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as { paths?: string[]; tag?: string } | undefined
    if (activeData?.tag) {
      const overData = over.data.current as { groupId?: string | null } | undefined
      if (overData && 'groupId' in overData) {
        void assignTagToGroup(activeData.tag, overData.groupId ?? null)
      }
      return
    }

    const overData = over.data.current as { tag?: string; folderPath?: string } | undefined
    const paths = activeData?.paths
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

  const activeDragPhoto =
    activeDrag?.kind === 'photo' ? state.photosByPath.get(activeDrag.paths[0]) : undefined

  const TAB_ICON_SIZE = 20

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
      onDragCancel={() => setActiveDrag(null)}
    >
      {/* Wraps the whole AppShell (rather than just AppShell.Main) so the tab
          bar in the header — a Tabs.List sibling of Tabs.Panel deep inside
          Main — can share this context; Mantine's Tabs is context-driven, so
          List/Panel don't need to be DOM-adjacent to it. */}
      <Tabs
        // h={HEADER_HEIGHT}
        value={state.activeTab}
        onChange={(value) => value && setActiveTab(value)}
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
              desktop: state.detailsPanelCollapsed || isCompareTabActive || isDashboardTabActive,
              mobile: state.detailsPanelCollapsed || isCompareTabActive || isDashboardTabActive
            }
          }}
          padding={0}
        >
          <AppShell.Header h="auto">
            <Group px="md" justify="space-between">
              <Group gap="xs" wrap="nowrap">
                {/* <AppLogo /> */}
                <Title order={1} size="h5">
                  Tag Me
                </Title>
              </Group>
              <Tabs.List className="tabs-list-no-divider" style={{ flexGrow: 1 }}>
                <Scroller>
                  <Tooltip
                    openDelay={1000}
                    label={
                      <>
                        shortcut: <Kbd>d</Kbd>
                      </>
                    }
                  >
                    <Tabs.Tab
                      value="dashboard"
                      leftSection={<IconLayoutDashboard size={TAB_ICON_SIZE} />}
                    >
                      Dashboard
                    </Tabs.Tab>
                  </Tooltip>
                  <Tooltip
                    openDelay={1000}
                    label={
                      <>
                        shortcut: <Kbd>g</Kbd>
                      </>
                    }
                  >
                    <Tabs.Tab
                      value="gallery"
                      leftSection={<IconLibraryPhoto size={TAB_ICON_SIZE} />}
                    >
                      Gallery
                    </Tabs.Tab>
                  </Tooltip>
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
              <Group gap="md" wrap="nowrap">
                <ScanProgressBar />
                {!(isCompareTabActive || isDashboardTabActive) && (
                  <Tooltip
                    label={
                      state.detailsPanelCollapsed ? 'Show details panel' : 'Hide details panel'
                    }
                  >
                    <ActionIcon
                      variant="subtle"
                      aria-label="Toggle details panel"
                      onClick={() => setDetailsPanelCollapsed(!state.detailsPanelCollapsed)}
                    >
                      {state.detailsPanelCollapsed ? (
                        <IconLayoutSidebarRightExpand size={18} />
                      ) : (
                        <IconLayoutSidebarRightCollapse size={18} />
                      )}
                    </ActionIcon>
                  </Tooltip>
                )}
                <SettingsModal />
              </Group>
            </Group>
          </AppShell.Header>
          <AppShell.Navbar display="flex" style={{ flexDirection: 'column' }}>
            <Box p="md" style={{ flexShrink: 0 }}>
              <AllPhotosRow />
            </Box>
            <Divider />
            <PanelSection title="Tags" headerAction={<TagGroupCreateButton />}>
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
              <Tabs.Panel value="dashboard" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                <DashboardView />
              </Tabs.Panel>
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
            </Box>
          </AppShell.Main>
          <AppShell.Aside p="md" style={{ overflowY: 'auto' }}>
            <DetailPanel />
          </AppShell.Aside>
        </AppShell>
      </Tabs>
      <DragOverlay
        modifiers={[snapCenterToCursor]}
        style={
          activeDrag?.kind === 'tag'
            ? undefined
            : { width: DRAG_PREVIEW_SIZE, height: DRAG_PREVIEW_SIZE }
        }
      >
        {activeDrag?.kind === 'tag' ? (
          <TagDragPreview tag={activeDrag.tag} />
        ) : (
          activeDragPhoto && (
            <DragPreview
              photo={activeDragPhoto}
              count={activeDrag?.kind === 'photo' ? activeDrag.paths.length : 1}
            />
          )
        )}
      </DragOverlay>
    </DndContext>
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
