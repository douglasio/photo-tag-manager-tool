import { Menu } from '@mantine/core'
import { IconEdit } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'

interface TagContextMenuProps {
  onRename: () => void
  children: ReactNode
}

export function TagContextMenu({ onRename, children }: TagContextMenuProps): ReactElement {
  return (
    <Menu shadow="md" width={200}>
      <Menu.ContextMenu>{children}</Menu.ContextMenu>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconEdit size={14} />} onClick={onRename}>
          Rename
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
