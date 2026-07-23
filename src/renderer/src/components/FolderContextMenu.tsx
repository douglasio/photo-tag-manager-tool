import { Menu } from '@mantine/core'
import { IconEdit, IconFolderOpen } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'
import { isMac } from '../utils/platform'

interface FolderContextMenuProps {
  folderPath: string
  onRename: () => void
  children: ReactNode
}

export function FolderContextMenu({
  folderPath,
  onRename,
  children
}: FolderContextMenuProps): ReactElement {
  return (
    <Menu shadow="md" width={200}>
      <Menu.ContextMenu>{children}</Menu.ContextMenu>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconFolderOpen size={14} />}
          onClick={() => window.api.showItemInFolder(folderPath)}
        >
          Show in {isMac ? 'Finder' : 'Explorer'}
        </Menu.Item>
        <Menu.Item leftSection={<IconEdit size={14} />} onClick={onRename}>
          Rename
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
