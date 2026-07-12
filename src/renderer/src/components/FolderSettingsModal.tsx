import { ActionIcon, Button, Group, Modal, Stack, Text, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconSettings, IconTrash } from '@tabler/icons-react'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'

export function FolderSettingsModal(): ReactElement {
  const { state, addFolder, removeFolder } = usePhotoLibrary()
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
        <Tooltip label="Manage folders">
          <ActionIcon variant="subtle" color="gray" onClick={open} aria-label="Manage folders">
            <IconSettings size="70%" />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Modal opened={opened} onClose={close} title="Folders" size="lg">
        <Stack gap="sm">
          {state.folders.length === 0 && (
            <Text c="dimmed" size="sm">
              No folders added yet.
            </Text>
          )}
          {state.folders.map((folder) => (
            <Group key={folder} justify="space-between" wrap="nowrap" gap="md">
              <Text truncate="end" miw={0} style={{ flex: 1 }} title={folder}>
                {folder}
              </Text>
              <Tooltip label="Remove folder">
                <ActionIcon
                  variant="subtle"
                  style={{ flexShrink: 0 }}
                  onClick={() => void removeFolder(folder)}
                  aria-label={`Remove ${folder}`}
                >
                  <IconTrash size="70%" />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))}
          <Button onClick={() => void addFolder()} style={{ alignSelf: 'flex-start' }}>
            Add Folder…
          </Button>
        </Stack>
      </Modal>
    </>
  )
}
