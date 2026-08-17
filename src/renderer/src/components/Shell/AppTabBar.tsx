import { memo } from 'react'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { arrayMove, horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { ActionIcon, Group, Kbd, Scroller, Tabs, Tooltip } from '@mantine/core'
import {
  IconColumns2,
  IconLayoutDashboard,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconLibraryPhoto,
  IconStack2,
  IconX
} from '@tabler/icons-react'

import { CompareTabLabel, ScanProgressBar, SettingsModal, SortableTab, TabLabel } from '@components'
import { useLibraryActions } from '@renderer/state/PhotoLibraryActionsContext'
import { useGalleryLibrary } from '@renderer/state/PhotoLibraryGalleryContext'
import { ACTION_ICONS } from '@renderer/utils'

const TAB_ICON_SIZE = 20

// Zero props, memoized: bails out on AppLayout's own re-renders (e.g. a drag starting/ending),
// same pattern as NavbarSplitter — this was previously re-rendering on every one of those.
export const AppTabBar = memo(function AppTabBar(): React.JSX.Element {
  const { state, openTabEntries } = useGalleryLibrary()
  const { closePhotoTab, closeAllTabs, setDetailsPanelCollapsed, reorderPhotoTabs } =
    useLibraryActions()

  const isCompareTabActive = state.compareTabs.has(state.activeTab)
  const isDashboardTabActive = state.activeTab === 'dashboard'
  const isDuplicatesTabActive = state.activeTab === 'duplicates'

  // DndContext scoped to just the photo-tab row.
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
            <Tabs.Tab value="dashboard" leftSection={<IconLayoutDashboard size={TAB_ICON_SIZE} />}>
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
            <Tabs.Tab value="gallery" leftSection={<IconLibraryPhoto size={TAB_ICON_SIZE} />}>
              Gallery
            </Tabs.Tab>
          </Tooltip>
          <DndContext
            sensors={tabSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleTabDragEnd}
          >
            <SortableContext items={state.openTabs} strategy={horizontalListSortingStrategy}>
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
                    <CompareTabLabel fileNames={entry.photos.map((photo) => photo.fileName)} />
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
            label={state.detailsPanelCollapsed ? 'Show details panel' : 'Hide details panel'}
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
  )
})
