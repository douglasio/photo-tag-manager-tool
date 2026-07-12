import { Burger, Button, Group, Modal, Stack, Table, Text, Title, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { FolderRemoveButton } from './FolderRemoveButton'

function SectionTitle({ children }: { children: string }): ReactElement {
  return (
    <Title order={6} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
      {children}
    </Title>
  )
}

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
        </Stack>
      </Modal>
    </>
  )
}
