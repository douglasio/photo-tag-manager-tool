import { ActionIcon, AppShell, Box, Divider, Group, Tabs, Title } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { PhotoLibraryProvider, usePhotoLibrary } from './state/PhotoLibraryContext'
import { AppLogo } from './components/AppLogo'
import { SettingsModal } from './components/SettingsModal'
import { ScanProgressBar } from './components/ScanProgressBar'
import { GalleryGrid } from './components/GalleryGrid'
import { DetailPanel } from './components/DetailPanel'
import { FolderTree } from './components/FolderTree'
import { PanelSection } from './components/PanelSection'
import { PhotoView } from './components/PhotoView'
import { TagPanel } from './components/TagPanel'

const HEADER_HEIGHT = 52

// Split out from App so it can call usePhotoLibrary — a component can't read
// a context it also renders the Provider for in the same function.
function AppLayout(): React.JSX.Element {
  const { state, openTabPhotos, closePhotoTab, setActiveTab } = usePhotoLibrary()
  const hasTabs = state.openTabs.length > 0
  // Panels only hide while an actual photo tab is active — switching back to
  // the Gallery tab (with other photo tabs still open in the background)
  // restores the normal three-pane layout.
  const isPhotoTabActive = state.activeTab !== 'gallery'

  return (
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
        collapsed: { desktop: isPhotoTabActive, mobile: isPhotoTabActive }
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
            <SettingsModal />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar style={{ display: 'flex', flexDirection: 'column' }}>
        <PanelSection title="Tags">
          <TagPanel />
        </PanelSection>
        <Divider />
        <PanelSection title="Folders">
          <FolderTree />
        </PanelSection>
      </AppShell.Navbar>
      <AppShell.Main>
        <Box
          style={{
            height: `calc(100dvh - ${HEADER_HEIGHT}px)`,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {hasTabs ? (
            <Tabs
              value={state.activeTab}
              onChange={(value) => value && setActiveTab(value)}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
            >
              <Tabs.List style={{ flexShrink: 0 }}>
                <Tabs.Tab value="gallery">Gallery</Tabs.Tab>
                {openTabPhotos.map((photo) => (
                  <Tabs.Tab
                    key={photo.filePath}
                    value={photo.filePath}
                    rightSection={
                      <ActionIcon
                        component="span"
                        size="xs"
                        variant="subtle"
                        color="gray"
                        onClick={(event) => {
                          event.stopPropagation()
                          closePhotoTab(photo.filePath)
                        }}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    }
                  >
                    {photo.fileName}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
              <Tabs.Panel value="gallery" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                <GalleryGrid />
              </Tabs.Panel>
              {openTabPhotos.map((photo) => (
                <Tabs.Panel
                  key={photo.filePath}
                  value={photo.filePath}
                  style={{ flex: 1, minHeight: 0, display: 'flex' }}
                >
                  <PhotoView photo={photo} />
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
  )
}

function App(): React.JSX.Element {
  return (
    <PhotoLibraryProvider>
      <AppLayout />
    </PhotoLibraryProvider>
  )
}

export default App
