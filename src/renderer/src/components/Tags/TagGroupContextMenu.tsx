import { Menu } from '@mantine/core'
import { IconEdit, IconTrash } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'

interface TagGroupContextMenuProps {
  onRename: () => void
  onDelete: () => void
  children: ReactNode
}

export function TagGroupContextMenu({
  onRename,
  onDelete,
  children
}: TagGroupContextMenuProps): ReactElement {
  return (
    <Menu shadow="md" width={200}>
      <Menu.ContextMenu>{children}</Menu.ContextMenu>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconEdit size={14} />} onClick={onRename}>
          Rename
        </Menu.Item>
        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
