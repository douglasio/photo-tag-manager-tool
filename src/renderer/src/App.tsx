import { AppShell, Box, Group, Title } from '@mantine/core'
import { PhotoLibraryProvider } from './state/PhotoLibraryContext'
import { FolderPicker } from './components/FolderPicker'
import { ScanProgressBar } from './components/ScanProgressBar'
import { GalleryGrid } from './components/GalleryGrid'
import { DetailPanel } from './components/DetailPanel'

const HEADER_HEIGHT = 52

function App(): React.JSX.Element {
  return (
    <PhotoLibraryProvider>
      <AppShell
        header={{ height: HEADER_HEIGHT }}
        aside={{ width: 320, breakpoint: 0 }}
        padding={0}
      >
        <AppShell.Header>
          <Group h="100%" px="md" gap="md" wrap="nowrap">
            <Title order={1} size="h5" style={{ flexShrink: 0 }}>
              Tag Me
            </Title>
            <FolderPicker />
            <ScanProgressBar />
          </Group>
        </AppShell.Header>
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
