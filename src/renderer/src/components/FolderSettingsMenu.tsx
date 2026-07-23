import { ActionIcon, Menu, Switch } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'

export function FolderSettingsMenu(): ReactElement {
  const { state, setShowEmptyFolders } = usePhotoLibrary()

  return (
    <Menu shadow="md" width={220} closeOnItemClick={false}>
      <Menu.Target>
        <ActionIcon variant="subtle" aria-label="Folder settings">
          <IconSettings size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Folders</Menu.Label>
        <Switch
          m="xs"
          label="Show empty folders"
          checked={state.showEmptyFolders}
          onChange={(event) => setShowEmptyFolders(event.currentTarget.checked)}
        />
      </Menu.Dropdown>
    </Menu>
  )
}
