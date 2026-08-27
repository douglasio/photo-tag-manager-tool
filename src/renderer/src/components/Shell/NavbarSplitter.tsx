import { memo, useCallback, useState } from 'react'

import { AppShell, Splitter } from '@mantine/core'

import { FolderTree, PANEL_HEADER_HEIGHT, PeoplePanel, TagPanel } from '@components'
import { useLibraryActions } from '@renderer/state/PhotoLibraryActionsContext'
import { useSidebarLibrary } from '@renderer/state/PhotoLibrarySidebarContext'

// Pulled out of AppLayout so a Splitter drag only re-renders this subtree, not the whole app.
export const NavbarSplitter = memo(function NavbarSplitter(): React.JSX.Element {
  const { state } = useSidebarLibrary()
  const { setNavbarSplitSizes, setNavbarCollapsedPanels } = useLibraryActions()

  // Default even split; People pane only exists once face detection is enabled.
  const navbarPaneSizes = state.faceDetectionEnabled ? [34, 33, 33] : [50, 50]
  // Stable ids (not index) to key navbarCollapsedPanels, since People's pane can appear/disappear.
  const navbarPaneIds = state.faceDetectionEnabled
    ? ['tags', 'people', 'folders']
    : ['tags', 'folders']

  // Collapse uses Splitter's `sizes` prop (fixed header height) rather than its collapse() API,
  // which snaps to 0 with no way back. Self-heals a stored 0 (old collapse-to-zero bug) to the default.
  const defaultPaneSizes = (
    state.navbarSplitSizes.length === navbarPaneSizes.length
      ? state.navbarSplitSizes
      : navbarPaneSizes
  ).map((size, index) => (size > 0 ? size : navbarPaneSizes[index]))
  // Live drag position, separate from state.navbarSplitSizes — committing to the reducer/IPC on
  // every drag frame is what made resizing laggy; that commit now happens once, on release.
  const [liveNavbarSizes, setLiveNavbarSizes] = useState<number[] | null>(null)
  const navbarSizes = navbarPaneIds.map((id, index) =>
    state.navbarCollapsedPanels[id]
      ? `${PANEL_HEADER_HEIGHT}px`
      : (liveNavbarSizes ?? defaultPaneSizes)[index]
  )
  // Stable across drags (dragging never touches navbarCollapsedPanels), so the memoized
  // TagPanel/PeoplePanel/FolderTree below can actually bail out during a drag.
  const toggleNavbarPanel = useCallback(
    (id: string): void => {
      setNavbarCollapsedPanels({
        ...state.navbarCollapsedPanels,
        [id]: !state.navbarCollapsedPanels[id]
      })
    },
    [state.navbarCollapsedPanels, setNavbarCollapsedPanels]
  )
  const toggleTagsPanel = useCallback(() => toggleNavbarPanel('tags'), [toggleNavbarPanel])
  const togglePeoplePanel = useCallback(() => toggleNavbarPanel('people'), [toggleNavbarPanel])
  const toggleFoldersPanel = useCallback(() => toggleNavbarPanel('folders'), [toggleNavbarPanel])

  // CSS transition animates collapse/expand, but only via the toggle button — during an active
  // drag it would lag a frame behind the cursor.
  const [isResizingNavbar, setIsResizingNavbar] = useState(false)
  const navbarPaneTransition = isResizingNavbar
    ? undefined
    : 'flex-basis 200ms ease, flex-grow 200ms ease'

  return (
    <AppShell.Section grow mih={0} display="flex" style={{ flexDirection: 'column' }}>
      <Splitter
        orientation="vertical"
        withHandle={false}
        handleColor="var(--mantine-color-default-border)"
        classNames={{ handle: 'navbar-splitter-handle' }}
        sizes={navbarSizes}
        onResizeStart={() => setIsResizingNavbar(true)}
        onResizeEnd={() => {
          setIsResizingNavbar(false)
          // Commit to the reducer/persisted settings once, here (see liveNavbarSizes above).
          if (liveNavbarSizes) {
            setNavbarSplitSizes(liveNavbarSizes)
            setLiveNavbarSizes(null)
          }
        }}
        onSizeChange={(sizes) => {
          // Don't persist a collapsed pane's fixed header height as its "real" size.
          const merged = navbarPaneIds.map((id, index) =>
            state.navbarCollapsedPanels[id] ? defaultPaneSizes[index] : sizes[index]
          )
          setLiveNavbarSizes(merged as number[])
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
            onToggleCollapse={toggleTagsPanel}
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
              onToggleCollapse={togglePeoplePanel}
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
            onToggleCollapse={toggleFoldersPanel}
          />
        </Splitter.Pane>
      </Splitter>
    </AppShell.Section>
  )
})
