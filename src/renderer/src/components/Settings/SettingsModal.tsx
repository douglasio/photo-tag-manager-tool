import {
  Burger,
  Button,
  Divider,
  Group,
  Modal,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  TextInput,
  Title,
  Tooltip
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState, type ReactElement } from 'react'
import { usePhotoLibrary } from '../../state/PhotoLibraryContext'
import { FolderRemoveButton } from '../Folders/FolderRemoveButton'
import { SectionTitle } from '../Shared/SectionTitle'

function FoldersSection(): ReactElement {
  const { state, addFolder } = usePhotoLibrary()

  return (
    <Stack gap="xs">
      <SectionTitle>Folders</SectionTitle>
      {state.folders.length === 0 ? (
        <Text c="dimmed" size="sm">
          No folders added yet.
        </Text>
      ) : (
        <Table striped highlightOnHover layout="fixed" verticalSpacing="xs">
          <Table.Tbody>
            {state.folders.map((folder) => (
              <Table.Tr key={folder}>
                <Table.Td>
                  <Text truncate="end" miw={0} title={folder}>
                    {folder}
                  </Text>
                </Table.Td>
                <Table.Td w={44}>
                  <FolderRemoveButton folder={folder} count={state.folderCounts.get(folder) ?? 0} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Button onClick={() => void addFolder()} style={{ alignSelf: 'flex-start' }}>
        Add Folder…
      </Button>
    </Stack>
  )
}

function GallerySection(): ReactElement {
  const { state, setGalleryAnimationsEnabled, setShowEmptyFolders } = usePhotoLibrary()

  return (
    <Stack gap="xs">
      <SectionTitle>Gallery</SectionTitle>
      <Switch
        label="Show empty folders"
        checked={state.showEmptyFolders}
        onChange={(event) => setShowEmptyFolders(event.currentTarget.checked)}
      />
      <Switch
        label="Enable animations"
        description="Show various animations when navigating the app. Automatically off if your system prefers reduced motion."
        checked={state.galleryAnimationsEnabled}
        onChange={(event) => setGalleryAnimationsEnabled(event.currentTarget.checked)}
      />
    </Stack>
  )
}

function ExcludePatternsSection(): ReactElement {
  const { state, setExcludePatterns } = usePhotoLibrary()

  return (
    <Stack gap="xs">
      <SectionTitle>Exclude Patterns</SectionTitle>
      <Text c="dimmed" size="sm">
        Folders or files whose path contains any of these (case-insensitive) are skipped during
        scanning.
      </Text>
      <TagsInput
        value={state.excludePatterns}
        onChange={(patterns) => void setExcludePatterns(patterns)}
        placeholder="Add a pattern…"
      />
    </Stack>
  )
}

function VisualizationsSection(): ReactElement {
  const { state, setMagazineTitle, setNewspaperTitle, setDvdStudioName } = usePhotoLibrary()
  const [magazineDraft, setMagazineDraft] = useState(state.magazineTitle)
  const [newspaperDraft, setNewspaperDraft] = useState(state.newspaperTitle)
  const [dvdDraft, setDvdDraft] = useState(state.dvdStudioName)

  // Resync the drafts if the persisted values change from outside this
  // component (e.g. hydration finishing after mount) — adjusted during
  // render per this codebase's convention, rather than a useEffect.
  const [syncedMagazine, setSyncedMagazine] = useState(state.magazineTitle)
  if (syncedMagazine !== state.magazineTitle) {
    setSyncedMagazine(state.magazineTitle)
    setMagazineDraft(state.magazineTitle)
  }
  const [syncedNewspaper, setSyncedNewspaper] = useState(state.newspaperTitle)
  if (syncedNewspaper !== state.newspaperTitle) {
    setSyncedNewspaper(state.newspaperTitle)
    setNewspaperDraft(state.newspaperTitle)
  }
  const [syncedDvd, setSyncedDvd] = useState(state.dvdStudioName)
  if (syncedDvd !== state.dvdStudioName) {
    setSyncedDvd(state.dvdStudioName)
    setDvdDraft(state.dvdStudioName)
  }

  return (
    <Stack gap="xs">
      <SectionTitle>Visualizations</SectionTitle>
      <Text c="dimmed" size="sm">
        Masthead/studio text shown on the Photo view&apos;s magazine, newspaper, and DVD cover
        visualizations.
      </Text>
      <TextInput
        label="Magazine title"
        value={magazineDraft}
        onChange={(event) => setMagazineDraft(event.currentTarget.value)}
        onBlur={() => setMagazineTitle(magazineDraft.trim())}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      <TextInput
        label="Newspaper title"
        value={newspaperDraft}
        onChange={(event) => setNewspaperDraft(event.currentTarget.value)}
        onBlur={() => setNewspaperTitle(newspaperDraft.trim())}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      <TextInput
        label="DVD production studio"
        value={dvdDraft}
        onChange={(event) => setDvdDraft(event.currentTarget.value)}
        onBlur={() => setDvdStudioName(dvdDraft.trim())}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </Stack>
  )
}

export function SettingsModal(): ReactElement {
  const { state } = usePhotoLibrary()
  const [opened, { open, close }] = useDisclosure(false)

  return (
    <>
      <Group gap="sm" wrap="nowrap">
        {state.folders.length === 0 && (
          <Button
            variant="gradient"
            gradient={{ from: 'violet', to: 'cyan', deg: 90 }}
            onClick={open}
          >
            Add a folder to get started
          </Button>
        )}
        <Tooltip label="Manage settings">
          <Burger opened={opened} onClick={open} size="sm" aria-label="Manage settings" />
        </Tooltip>
      </Group>

      <Modal opened={opened} onClose={close} title={<Title order={2}>Settings</Title>} size="lg">
        <Stack gap="lg">
          <FoldersSection />
          <Divider />
          <GallerySection />
          <Divider />
          <VisualizationsSection />
          <Divider />
          <ExcludePatternsSection />
        </Stack>
      </Modal>
    </>
  )
}
