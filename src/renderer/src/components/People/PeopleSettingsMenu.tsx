import { ActionIcon, Menu, Switch } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { useLibraryActions, useSidebarLibrary } from '@state'
import { ACTION_ICONS } from '@utils'

export function PeopleSettingsMenu(): ReactElement {
  const { state } = useSidebarLibrary()
  const { setPeoplePanelGridView } = useLibraryActions()

  const { BUTTON_SIZE, ICON_SIZE } = ACTION_ICONS

  return (
    <Menu shadow="md" width={220} closeOnItemClick={false}>
      <Menu.Target>
        {/* mr="sm" lines this icon's right edge up with the count badges in
            the person rows below — those sit inset from the row's own right
            edge by the Button's rightSection padding (12px = spacing "sm"
            at the default button size), while this icon otherwise sits
            flush with the panel edge. Mirrors FolderSettingsMenu. */}
        <ActionIcon variant="subtle" mr="sm" aria-label="People settings" size={BUTTON_SIZE}>
          <IconSettings size={ICON_SIZE} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>People</Menu.Label>
        <Switch
          m="xs"
          label="Grid view"
          checked={state.peoplePanelGridView}
          onChange={(event) => setPeoplePanelGridView(event.currentTarget.checked)}
        />
      </Menu.Dropdown>
    </Menu>
  )
}
