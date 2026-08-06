import { ActionIcon, Menu, Switch } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { usePhotoLibrary } from '@state'
import { ACTION_ICONS } from '@utils'

export function TagsSettingsMenu(): ReactElement {
  const { state, setTagsPanelGridView } = usePhotoLibrary()

  const { BUTTON_SIZE, ICON_SIZE } = ACTION_ICONS

  return (
    <Menu shadow="md" width={220} closeOnItemClick={false}>
      <Menu.Target>
        <ActionIcon variant="subtle" aria-label="Tags settings" size={BUTTON_SIZE}>
          <IconSettings size={ICON_SIZE} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Tags</Menu.Label>
        <Switch
          m="xs"
          label="Grid view"
          checked={state.tagsPanelGridView}
          onChange={(event) => setTagsPanelGridView(event.currentTarget.checked)}
        />
      </Menu.Dropdown>
    </Menu>
  )
}
