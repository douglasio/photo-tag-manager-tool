import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Center,
  Divider,
  Group,
  Image,
  Tabs,
  Title
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier
} from '@dnd-kit/core'
import { getEventCoordinates } from '@dnd-kit/utilities'
import { IconPhoto, IconX } from '@tabler/icons-react'
import { useState } from 'react'
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
import { toThumbProtocolUrl } from '../../shared/protocolUrls'
import type { PhotoRecord } from '../../shared/types'

const HEADER_HEIGHT = 52
const DRAG_PREVIEW_SIZE = 64

// DragOverlay positions itself using the ORIGINAL dragged element's
// bounding box by default, offset by pointer movement — since our preview
// is a fixed, much smaller size than the full gallery thumbnail being
// dragged, that leaves it visually far from the cursor. This is dnd-kit's
// own documented recipe for snapping the overlay so it's centered directly
// under the pointer instead, regardless of the source element's size.
const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (draggingNodeRect && activatorEvent) {
    const activatorCoordinates = getEventCoordinates(activatorEvent)
    if (!activatorCoordinates) return transform
    const offsetX = activatorCoordinates.x - draggingNodeRect.left
    const offsetY = activatorCoordinates.y - draggingNodeRect.top
    return {
      ...transform,
      x: transform.x + offsetX - draggingNodeRect.width / 2,
      y: transform.y + offsetY - draggingNodeRect.height / 2
    }
  }
  return transform
}

// The DragOverlay ghost that follows the cursor while a gallery thumbnail is
// being dragged onto a tag — a real DOM element (unlike the browser's native
// drag-image snapshot), so ordinary CSS covers translucency/sizing/badges.
function DragPreview({ photo, count }: { photo: PhotoRecord; count: number }): React.JSX.Element {
  return (
    <Box pos="relative" w={DRAG_PREVIEW_SIZE} h={DRAG_PREVIEW_SIZE}>
      <Box
        style={{
          width: DRAG_PREVIEW_SIZE,
          height: DRAG_PREVIEW_SIZE,
          opacity: 0.75,
          borderRadius: 'var(--mantine-radius-default)',
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
  const { state, openTabPhotos, closePhotoTab, setActiveTab, addTagsToPhotos } = usePhotoLibrary()
  const hasTabs = state.openTabs.length > 0
  // Panels only hide while an actual photo tab is active — switching back to
  // the Gallery tab (with other photo tabs still open in the background)
  // restores the normal three-pane layout.
  const isPhotoTabActive = state.activeTab !== 'gallery'

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
    const tag = (over.data.current as { tag?: string } | undefined)?.tag
    const paths = (active.data.current as { paths?: string[] } | undefined)?.paths
    if (!tag || !paths || paths.length === 0) return
    void addTagsToPhotos([tag], paths).then(() => {
      notifications.show({
        color: 'teal',
        message: `Added #${tag} to ${paths.length} photo${paths.length === 1 ? '' : 's'}`
      })
    })
  }

  const activeDragPhoto = activeDragPaths ? state.photosByPath.get(activeDragPaths[0]) : undefined

  return (
    <DndContext
      sensors={sensors}
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
      <DragOverlay modifiers={[snapCenterToCursor]}>
        {activeDragPhoto && (
          <DragPreview photo={activeDragPhoto} count={activeDragPaths?.length ?? 1} />
        )}
      </DragOverlay>
    </DndContext>
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
