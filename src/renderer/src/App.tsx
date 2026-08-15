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
  Splitter,
  Tabs,
  Text,
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
  IconStack2,
  IconX
} from '@tabler/icons-react'

import {
  AllPhotosRow,
  // AppLogo,
  CompareTabLabel,
  CompareView,
  DashboardView,
  DetailPanel,
  DuplicatesView,
  FolderTree,
  GalleryGrid,
  PANEL_HEADER_HEIGHT,
  PeoplePanel,
  PersonMergeDialog,
  PhotoView,
  ScanProgressBar,
  SettingsModal,
  SortableTab,
  StartupLoadingScreen,
  TabLabel,
  TagPanel,
  UntaggedRow
} from '@components'
import { RADIUS_SIZE } from '@renderer/theme'
import { ACTION_ICONS } from '@renderer/utils'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { PREVIEW_TRIGGER_KEY } from '@utils'

import { PhotoLibraryProvider, usePhotoLibrary } from './state/PhotoLibraryContext'

// True while focus is inside anything the "g" shortcut below shouldn't
// hijack a keystroke from (text/date inputs, contenteditable, etc.).
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

// Roles/elements that natively activate on a Space keypress — space must
// keep its default behavior there instead of being swallowed globally below.
const SPACE_ACTIVATABLE_ROLES = new Set([
  'button',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option'
])

function isSpaceActivatable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (isEditableTarget(target)) return true
  if (['BUTTON', 'A', 'SUMMARY'].includes(target.tagName)) return true
  const role = target.getAttribute('role')
  return role !== null && SPACE_ACTIVATABLE_ROLES.has(role)
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
        bdrs={RADIUS_SIZE}
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
            <IconPhoto size={ACTION_ICONS.ICON_SIZE} />
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
    <Paper
      withBorder
      shadow="md"
      px="sm"
      py={4}
      radius={RADIUS_SIZE}
      style={{ cursor: 'grabbing' }}
    >
      <Text size="sm" fw={500}>
        #{tag}
      </Text>
    </Paper>
  )
}

// The DragOverlay ghost for a face being dragged onto a person — same
// lightweight shape as TagDragPreview above (no crop-thumbnail rendering,
// just a name-less placeholder since a bare face has no label to show).
function FaceDragPreview(): React.JSX.Element {
  return (
    <Paper
      withBorder
      shadow="md"
      px="sm"
      py={4}
      radius={RADIUS_SIZE}
      style={{ cursor: 'grabbing' }}
    >
      <Text size="sm" fw={500}>
        Face
      </Text>
    </Paper>
  )
}

// The DragOverlay ghost for a person being dragged onto another one to merge.
function PersonDragPreview({ name }: { name: string | null }): React.JSX.Element {
  return (
    <Paper
      withBorder
      shadow="md"
      px="sm"
      py={4}
      radius={RADIUS_SIZE}
      style={{ cursor: 'grabbing' }}
    >
      <Text size="sm" fw={500}>
        {name ?? 'Unnamed person'}
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
    closeAllTabs,
    setActiveTab,
    addTagsToPhotos,
    movePhotosToFolder,
    setDetailsPanelCollapsed,
    reorderPhotoTabs,
    assignTagToGroup,
    assignFaceToPerson,
    mergePeople,
    setNavbarSplitSizes,
    setNavbarCollapsedPanels
  } = usePhotoLibrary()
  // The navbar (Tags/Folders) hides for any non-Gallery tab, including Dashboard (full-screen, no side panels) — switching back to Gallery (with other tabs still open in the background) restores it. The details aside is independent of this: it's user-togglable and persisted, shown on both the gallery and photo-view screens.
  const isPhotoTabActive = state.activeTab !== 'gallery'
  // Compare View always hides the details panel outright
  const isCompareTabActive = state.compareTabs.has(state.activeTab)
  // Dashboard is full-screen — no details panel either.
  const isDashboardTabActive = state.activeTab === 'dashboard'
  // Duplicates tab browses across many photos at once — no single photo for
  // the details panel to describe.
  const isDuplicatesTabActive = state.activeTab === 'duplicates'

  // Default even split for the navbar Splitter's current pane count (Tags,
  // People, Folders — People only present once face detection is enabled).
  const navbarPaneSizes = state.faceDetectionEnabled ? [34, 33, 33] : [50, 50]
  // Stable ids for the same panes, in render order — used to key the
  // id-keyed navbarCollapsedPanels record (index alone would silently mean
  // a different panel once People's pane appears/disappears).
  const navbarPaneIds = state.faceDetectionEnabled
    ? ['tags', 'people', 'folders']
    : ['tags', 'folders']

  // Collapse is driven entirely through Splitter's `sizes` prop (a fixed-px
  // entry for a collapsed pane, its normal flexible size otherwise) rather
  // than Splitter's own collapsible/collapse() API — that API always snaps a
  // pane to literal 0 (verified against @mantine/hooks' source), which would
  // hide its header too and leave no way to re-expand it. This way a
  // "collapsed" pane still reserves exactly PanelSection's header height.
  // Self-healing against a specific pre-existing corruption: the old
  // collapse-to-zero behavior (before this fix) persisted a literal 0 into
  // navbarSplitSizes for whichever pane was collapsed at the time, since
  // Splitter's native collapse() reports the panel's size as 0 through
  // onSizeChange. A stored 0 is never a size a user actually wants "expanded"
  // to, so fall back to the even-split default for that one slot instead of
  // trusting it forever.
  const defaultPaneSizes = (
    state.navbarSplitSizes.length === navbarPaneSizes.length
      ? state.navbarSplitSizes
      : navbarPaneSizes
  ).map((size, index) => (size > 0 ? size : navbarPaneSizes[index]))
  const navbarSizes = navbarPaneIds.map((id, index) =>
    state.navbarCollapsedPanels[id] ? `${PANEL_HEADER_HEIGHT}px` : defaultPaneSizes[index]
  )
  const toggleNavbarPanel = (id: string): void => {
    setNavbarCollapsedPanels({
      ...state.navbarCollapsedPanels,
      [id]: !state.navbarCollapsedPanels[id]
    })
  }

  // Sizing is plain flex-basis/flex-grow under the hood (verified against
  // @mantine/core's Splitter source), so a CSS transition animates collapse/
  // expand for free — but only when the size change comes from the toggle
  // button, not from an active drag, where a transition would lag a frame
  // behind the cursor instead of tracking it 1:1.
  const [isResizingNavbar, setIsResizingNavbar] = useState(false)
  const navbarPaneTransition = isResizingNavbar
    ? undefined
    : 'flex-basis 200ms ease, flex-grow 200ms ease'

  // Mantine's Tooltip only closes on a real mouseleave (it's built on
  // floating-ui's useHover) — clicking a tooltip's own trigger doesn't
  // dismiss it, so if that click's handler navigates away (e.g. opens a
  // different tab) while the mouse never actually left the button, the
  // tooltip has no event left to close it and stays floating over whatever
  // renders next. floating-ui supports exactly this case via useDismiss's
  // referencePress option, but Mantine's Tooltip doesn't expose it. This
  // reproduces the same effect globally: every Mantine floating element
  // (Tooltip, Popover, Menu, ...) closes on a real Escape keydown via its
  // own built-in dismiss handling, so dispatching one on every pointerdown
  // — before the target's own click handler runs — closes whatever's
  // currently open first, regardless of what that click goes on to do.
  useEffect(() => {
    const handlePointerDown = (): void => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

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

  // Space bar's default action is page-down scrolling, which fights with
  // its other job as the hover/photo preview trigger — suppressed globally
  // except where a focused control natively needs Space (buttons, inputs...).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== PREVIEW_TRIGGER_KEY) return
      if (isSpaceActivatable(event.target)) return
      event.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Four independent drag domains share this one DndContext (tags can't
  // move to a second, nested context scoped to the tag panel without
  // shadowing their existing useDroppable — see the tag-drag branch below)
  // — 'photo' is the original dragged-thumbnail-onto-tag/folder flow, 'tag'
  // is a tag being dragged into a group, 'face' is a face (from
  // DetailPanelFaces) being dragged onto a person (assign), 'person' is a
  // whole person row dragged onto another one (merge).
  const [activeDrag, setActiveDrag] = useState<
    | { kind: 'photo'; paths: string[] }
    | { kind: 'tag'; tag: string }
    | { kind: 'face'; faceId: string }
    | { kind: 'person'; personId: string; personName: string | null }
    | null
  >(null)

  // Dropping one person onto another stages a merge here rather than
  // applying it immediately — unlike a single face assignment, a merge
  // deletes a whole person row, so it gets an explicit confirm step.
  const [pendingMerge, setPendingMerge] = useState<{
    sourceId: string
    sourceName: string
    targetId: string
    targetName: string
  } | null>(null)
  const [mergeSaving, setMergeSaving] = useState(false)

  const handleConfirmMerge = async (): Promise<void> => {
    if (!pendingMerge) return
    setMergeSaving(true)
    try {
      await mergePeople(pendingMerge.sourceId, pendingMerge.targetId)
      setPendingMerge(null)
    } finally {
      setMergeSaving(false)
    }
  }

  const sensors = useSensors(
    // Requires a small pointer move before a drag "starts," so an ordinary
    // click (select, rename, etc.) is never mistaken for a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragStart = (event: DragStartEvent): void => {
    const data = event.active.data.current as
      | {
          paths?: string[]
          tag?: string
          faceId?: string
          personId?: string
          personName?: string | null
        }
      | undefined
    if (data?.tag) {
      setActiveDrag({ kind: 'tag', tag: data.tag })
      return
    }
    if (data?.faceId) {
      setActiveDrag({ kind: 'face', faceId: data.faceId })
      return
    }
    if (data?.personId) {
      setActiveDrag({
        kind: 'person',
        personId: data.personId,
        personName: data.personName ?? null
      })
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

    const activeData = active.data.current as
      | {
          paths?: string[]
          tag?: string
          faceId?: string
          personId?: string
          personName?: string | null
        }
      | undefined
    if (activeData?.tag) {
      const overData = over.data.current as { groupId?: string | null } | undefined
      if (overData && 'groupId' in overData) {
        void assignTagToGroup(activeData.tag, overData.groupId ?? null)
      }
      return
    }

    if (activeData?.faceId) {
      const overData = over.data.current as { personId?: string } | undefined
      if (overData?.personId) {
        void assignFaceToPerson(activeData.faceId, overData.personId)
      }
      return
    }

    if (activeData?.personId) {
      const overData = over.data.current as { personId?: string } | undefined
      if (overData?.personId && overData.personId !== activeData.personId) {
        const targetName = state.people.find((p) => p.id === overData.personId)?.name
        setPendingMerge({
          sourceId: activeData.personId,
          sourceName: activeData.personName ?? 'Unnamed person',
          targetId: overData.personId,
          targetName: targetName ?? 'Unnamed person'
        })
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
      <Tabs value={state.activeTab} onChange={(value) => value && setActiveTab(value)}>
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
              desktop:
                state.detailsPanelCollapsed ||
                isCompareTabActive ||
                isDashboardTabActive ||
                isDuplicatesTabActive,
              mobile:
                state.detailsPanelCollapsed ||
                isCompareTabActive ||
                isDashboardTabActive ||
                isDuplicatesTabActive
            }
          }}
          padding={0}
        >
          <AppShell.Header h="auto">
            <Group px="md" justify="space-between" wrap="nowrap">
              <Tabs.List className="tabs-list-no-divider" miw={0} style={{ flexGrow: 1 }}>
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
                            entry.kind === 'compare' ? (
                              <IconColumns2 size={ACTION_ICONS.ICON_SIZE} />
                            ) : entry.kind === 'duplicates' ? (
                              <IconStack2 size={ACTION_ICONS.ICON_SIZE} />
                            ) : undefined
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
                              <IconX size={ACTION_ICONS.ICON_SIZE} />
                            </ActionIcon>
                          }
                        >
                          {entry.kind === 'compare' ? (
                            <CompareTabLabel
                              fileNames={entry.photos.map((photo) => photo.fileName)}
                            />
                          ) : entry.kind === 'duplicates' ? (
                            'Duplicates'
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
                {state.openTabs.length > 0 && (
                  <Tooltip label="Close all tabs">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="Close all tabs"
                      onClick={closeAllTabs}
                    >
                      <IconX size={ACTION_ICONS.ICON_SIZE} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <ScanProgressBar />
                {!(isCompareTabActive || isDashboardTabActive || isDuplicatesTabActive) && (
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
                        <IconLayoutSidebarRightExpand size={ACTION_ICONS.ICON_SIZE} />
                      ) : (
                        <IconLayoutSidebarRightCollapse size={ACTION_ICONS.ICON_SIZE} />
                      )}
                    </ActionIcon>
                  </Tooltip>
                )}
                <SettingsModal />
              </Group>
            </Group>
          </AppShell.Header>
          <AppShell.Navbar display="flex" style={{ flexDirection: 'column' }}>
            <AppShell.Section component={AllPhotosRow} />
            <AppShell.Section component={UntaggedRow} />
            <Divider />
            <AppShell.Section grow mih={0} display="flex" style={{ flexDirection: 'column' }}>
              <Splitter
                orientation="vertical"
                withHandle={false}
                handleColor="var(--mantine-color-default-border)"
                sizes={navbarSizes}
                onResizeStart={() => setIsResizingNavbar(true)}
                onResizeEnd={() => setIsResizingNavbar(false)}
                onSizeChange={(sizes) => {
                  // Never persist a collapsed pane's fixed header-height
                  // entry as its "real" size — keep whatever was there
                  // before, so un-collapsing restores a sensible split
                  // instead of reopening at header height.
                  const merged = navbarPaneIds.map((id, index) =>
                    state.navbarCollapsedPanels[id] ? defaultPaneSizes[index] : sizes[index]
                  )
                  setNavbarSplitSizes(merged as number[])
                }}
                flex={1}
                mih={0}
              >
                <Splitter.Pane
                  defaultSize={navbarPaneSizes[0]}
                  min={`${PANEL_HEADER_HEIGHT}px`}
                  mih={0}
                  display="flex"
                  style={{
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: navbarPaneTransition
                  }}
                >
                  <TagPanel
                    collapsed={Boolean(state.navbarCollapsedPanels.tags)}
                    onToggleCollapse={() => toggleNavbarPanel('tags')}
                  />
                </Splitter.Pane>
                {state.faceDetectionEnabled && (
                  <Splitter.Pane
                    defaultSize={navbarPaneSizes[1]}
                    min={`${PANEL_HEADER_HEIGHT}px`}
                    mih={0}
                    display="flex"
                    style={{
                      flexDirection: 'column',
                      overflow: 'hidden',
                      transition: navbarPaneTransition
                    }}
                  >
                    <PeoplePanel
                      collapsed={Boolean(state.navbarCollapsedPanels.people)}
                      onToggleCollapse={() => toggleNavbarPanel('people')}
                    />
                  </Splitter.Pane>
                )}
                <Splitter.Pane
                  defaultSize={navbarPaneSizes[navbarPaneSizes.length - 1]}
                  min={`${PANEL_HEADER_HEIGHT}px`}
                  mih={0}
                  display="flex"
                  style={{
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: navbarPaneTransition
                  }}
                >
                  <FolderTree
                    collapsed={Boolean(state.navbarCollapsedPanels.folders)}
                    onToggleCollapse={() => toggleNavbarPanel('folders')}
                  />
                </Splitter.Pane>
              </Splitter>
            </AppShell.Section>
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
                  ) : entry.kind === 'duplicates' ? (
                    <DuplicatesView />
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
          activeDrag?.kind === 'tag' || activeDrag?.kind === 'face' || activeDrag?.kind === 'person'
            ? undefined
            : { width: DRAG_PREVIEW_SIZE, height: DRAG_PREVIEW_SIZE }
        }
      >
        {activeDrag?.kind === 'tag' ? (
          <TagDragPreview tag={activeDrag.tag} />
        ) : activeDrag?.kind === 'face' ? (
          <FaceDragPreview />
        ) : activeDrag?.kind === 'person' ? (
          <PersonDragPreview name={activeDrag.personName} />
        ) : (
          activeDragPhoto && (
            <DragPreview
              photo={activeDragPhoto}
              count={activeDrag?.kind === 'photo' ? activeDrag.paths.length : 1}
            />
          )
        )}
      </DragOverlay>
      {pendingMerge && (
        <PersonMergeDialog
          sourceName={pendingMerge.sourceName}
          targetName={pendingMerge.targetName}
          opened
          saving={mergeSaving}
          onConfirm={() => void handleConfirmMerge()}
          onCancel={() => setPendingMerge(null)}
        />
      )}
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
