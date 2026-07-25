import { ActionIcon, Menu, Switch } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../../state/PhotoLibraryContext'

export function GallerySettingsMenu(): ReactElement {
  const { state, setShowFilenames } = usePhotoLibrary()

  return (
    <Menu shadow="md" width={220} closeOnItemClick={false} position="bottom-end">
      <Menu.Target>
        <ActionIcon variant="subtle" aria-label="Gallery settings">
          <IconSettings size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Gallery</Menu.Label>
        <Switch
          m="xs"
          label="Show filenames"
          checked={state.showFilenames}
          onChange={(event) => setShowFilenames(event.currentTarget.checked)}
        />
      </Menu.Dropdown>
    </Menu>
  )
}
