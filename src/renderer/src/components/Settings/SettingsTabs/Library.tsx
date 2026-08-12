import React, { type ReactElement, useState } from 'react'

import { Button, Divider, Group, Stack, Table, TagsInput, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { ConfirmDialog, FolderRemoveButton } from '@components'
import { usePhotoLibrary } from '@state'

import SettingsTabSection from './SettingsTabSection'

function FoldersSection(): ReactElement {
  const { state, addFolder } = usePhotoLibrary()

  return (
    <Stack>
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

function ExcludePatternsSection(): ReactElement {
  const { state, setExcludePatterns } = usePhotoLibrary()

  return (
    <Stack>
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

// Export/import are a raw copy of the live SQLite file (settings, tags, tag
// groups, embeddings — everything), not a custom format — the simplest way
// to capture the library perfectly and restore it exactly. Both act on
// window.api directly rather than through PhotoLibraryContext: there's no
// ongoing renderer state to keep in sync, since import/clear relaunch the
// whole app and export is fire-and-forget.
export function DataSection(): ReactElement {
  const [importOpened, setImportOpened] = useState(false)
  const [importSaving, setImportSaving] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [clearOpened, setClearOpened] = useState(false)
  const [clearSaving, setClearSaving] = useState(false)

  const handleExport = async (): Promise<void> => {
    try {
      const exported = await window.api.exportDatabase()
      if (exported) notifications.show({ color: 'teal', message: 'Database exported.' })
    } catch (err) {
      console.error('failed to export database', err)
      notifications.show({ color: 'red', message: 'Failed to export database.' })
    }
  }

  const handleImportConfirm = async (): Promise<void> => {
    setImportError(null)
    setImportSaving(true)
    try {
      // Resolves normally (no-op) if the file picker inside this call was
      // canceled — success never actually returns, since the app relaunches.
      await window.api.importDatabase()
      setImportOpened(false)
    } catch (err) {
      console.error('failed to import database', err)
      setImportError(err instanceof Error ? err.message : 'Failed to import database.')
    } finally {
      setImportSaving(false)
    }
  }

  const handleClearConfirm = async (): Promise<void> => {
    setClearSaving(true)
    try {
      await window.api.clearLibrary()
      setClearOpened(false)
    } catch (err) {
      console.error('failed to clear library', err)
      notifications.show({ color: 'red', message: 'Failed to clear library.' })
    } finally {
      setClearSaving(false)
    }
  }

  return (
    <Stack>
      <Text c="dimmed" size="sm">
        Back up your library to a file, or restore from a previous backup.
      </Text>
      <Group>
        <Button onClick={() => void handleExport()}>Export Database</Button>
        <Button variant="default" onClick={() => setImportOpened(true)}>
          Import Database…
        </Button>
      </Group>

      <Divider label="Danger zone" labelPosition="left" c="red" mt="md" />
      <Button
        color="red"
        variant="light"
        onClick={() => setClearOpened(true)}
        style={{ alignSelf: 'flex-start' }}
      >
        Clear Library
      </Button>

      <ConfirmDialog
        title="Import database?"
        opened={importOpened}
        saving={importSaving}
        confirmLabel="Import"
        confirmColor="red"
        onConfirm={() => void handleImportConfirm()}
        onCancel={() => setImportOpened(false)}
      >
        <Text>
          This opens a file picker to choose a previously exported database file, then completely
          replaces your current library with it and restarts the app.
        </Text>
        <Text c="dimmed" mt="xs">
          Your current photos, tags, and settings will be gone.
        </Text>
        {importError && (
          <Text c="red" size="sm" mt="xs">
            {importError}
          </Text>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        title="Clear library?"
        opened={clearOpened}
        saving={clearSaving}
        confirmLabel="Clear Library"
        confirmColor="red"
        onConfirm={() => void handleClearConfirm()}
        onCancel={() => setClearOpened(false)}
      >
        <Text>
          This deletes every photo record, tag, and setting, and cannot be undone. The app restarts
          once it is done.
        </Text>
        <Text c="dimmed" mt="xs">
          Your original photo files on disk are not affected.
        </Text>
      </ConfirmDialog>
    </Stack>
  )
}

const sections = [
  { label: 'Folders', component: <FoldersSection /> },
  { label: 'Exclude Patterns', component: <ExcludePatternsSection /> },
  { label: 'Data', component: <DataSection /> }
]

export const Library: React.FC = () => {
  return (
    <Stack gap="lg">
      {sections.map((section, i) => (
        <SettingsTabSection key={`${section.label}-${i}`} title={section.label}>
          {section.component}
        </SettingsTabSection>
      ))}
    </Stack>
  )
}

export default Library
