import { ActionIcon, Menu, Switch } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { usePhotoLibrary } from '@state'
import { ACTION_ICONS } from '@utils'

export function FolderSettingsMenu(): ReactElement {
  const { state, setShowEmptyFolders } = usePhotoLibrary()

  const { BUTTON_SIZE, ICON_SIZE } = ACTION_ICONS

  return (
    <Menu shadow="md" width={220} closeOnItemClick={false}>
      <Menu.Target>
        {/* mr="sm" lines this icon's right edge up with the count badges in
            the folder rows below — those sit inset from the row's own right
            edge by the Button's rightSection padding (12px = spacing "sm"
            at the default button size), while this icon otherwise sits
            flush with the panel edge. */}
        <ActionIcon variant="subtle" mr="sm" aria-label="Folder settings" size={BUTTON_SIZE}>
          <IconSettings size={ICON_SIZE} />
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
