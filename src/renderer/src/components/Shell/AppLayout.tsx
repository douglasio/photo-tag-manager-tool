import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core'
import { AppShell, Box, Divider, Tabs } from '@mantine/core'

import {
  AllPhotosRow,
  CompareView,
  DashboardView,
  DetailPanel,
  DuplicatesView,
  GalleryGrid,
  PersonMergeDialog,
  PhotoView,
  UntaggedRow
} from '@components'
import { useAppDragAndDrop, useAppKeyboardShortcuts } from '@hooks'
import { ActiveDragContext } from '@renderer/state/ActiveDragContext'
import { useLibraryActions } from '@renderer/state/PhotoLibraryActionsContext'
import { useGalleryLibrary } from '@renderer/state/PhotoLibraryGalleryContext'
import { useSidebarLibrary } from '@renderer/state/PhotoLibrarySidebarContext'

import {
  DRAG_PREVIEW_SIZE,
  DragPreview,
  FaceDragPreview,
  PersonDragPreview,
  snapCenterToCursor,
  TagDragPreview
} from './AppDragPreviews'
import { AppTabBar } from './AppTabBar'
import { NavbarResizeHandle } from './NavbarResizeHandle'
import { NavbarSplitter } from './NavbarSplitter'

const HEADER_HEIGHT = 50

// Split out from App since a component can't read a context it also renders the Provider for.
export function AppLayout(): React.JSX.Element {
  const { state, openTabEntries } = useGalleryLibrary()
  const { state: sidebarState } = useSidebarLibrary()
  const { setActiveTab } = useLibraryActions()

  useAppKeyboardShortcuts()
  const {
    sensors,
    activeDrag,
    activeDragPhoto,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    pendingMerge,
    mergeSaving,
    handleConfirmMerge,
    cancelPendingMerge
  } = useAppDragAndDrop()

  // Navbar hides for any non-Gallery tab. Details aside is independent (user-togglable/persisted).
  const isPhotoTabActive = state.activeTab !== 'gallery'
  const isCompareTabActive = state.compareTabs.has(state.activeTab)
  const isDashboardTabActive = state.activeTab === 'dashboard'
  // No single photo for the details panel to describe when browsing duplicates.
  const isDuplicatesTabActive = state.activeTab === 'duplicates'

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Rows read this instead of dnd-kit's useDndContext(), which re-renders on every pointermove. */}
      <ActiveDragContext.Provider value={activeDrag?.kind ?? null}>
        {/* Wraps the whole AppShell so the header's Tabs.List (not DOM-adjacent to Tabs.Panel) can
            still share this context — Mantine's Tabs is context-driven, not position-driven. */}
        <Tabs value={state.activeTab} onChange={(value) => value && setActiveTab(value)}>
          <AppShell
            header={{ height: HEADER_HEIGHT }}
            navbar={{
              width: sidebarState.navbarWidth,
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
              <AppTabBar />
            </AppShell.Header>
            <AppShell.Navbar display="flex" style={{ flexDirection: 'column' }}>
              <AppShell.Section component={AllPhotosRow} />
              <AppShell.Section component={UntaggedRow} />
              <Divider />
              <NavbarSplitter />
              <NavbarResizeHandle />
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
            activeDrag?.kind === 'tag' ||
            activeDrag?.kind === 'face' ||
            activeDrag?.kind === 'person'
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
            onCancel={cancelPendingMerge}
          />
        )}
      </ActiveDragContext.Provider>
    </DndContext>
  )
}
