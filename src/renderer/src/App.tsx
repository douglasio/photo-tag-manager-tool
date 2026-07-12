import { AppShell, Box, Divider, Group, Title } from '@mantine/core'
import { PhotoLibraryProvider } from './state/PhotoLibraryContext'
import { FolderSettingsModal } from './components/FolderSettingsModal'
import { ScanProgressBar } from './components/ScanProgressBar'
import { GalleryGrid } from './components/GalleryGrid'
import { DetailPanel } from './components/DetailPanel'
import { FolderTree } from './components/FolderTree'
import { PanelSection } from './components/PanelSection'
import { TagPanel } from './components/TagPanel'

const HEADER_HEIGHT = 52

function App(): React.JSX.Element {
  return (
    <PhotoLibraryProvider>
      <AppShell
        header={{ height: HEADER_HEIGHT }}
        navbar={{ width: 260, breakpoint: 0 }}
        aside={{ width: 320, breakpoint: 0 }}
        padding={0}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Title order={1} size="h5" style={{ flexShrink: 0 }}>
              Tag Me
            </Title>
            <Group gap="md" wrap="nowrap">
              <ScanProgressBar />
              <FolderSettingsModal />
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
          <Box style={{ height: `calc(100dvh - ${HEADER_HEIGHT}px)`, display: 'flex' }}>
            <GalleryGrid />
          </Box>
        </AppShell.Main>
        <AppShell.Aside p="md" style={{ overflowY: 'auto' }}>
          <DetailPanel />
        </AppShell.Aside>
      </AppShell>
    </PhotoLibraryProvider>
  )
}

export default App
