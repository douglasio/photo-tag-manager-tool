import { Menu } from '@mantine/core'
import { IconEdit, IconTrash } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'

interface PersonContextMenuProps {
  onRename: () => void
  onDelete: () => void
  children: ReactNode
}

// Right-click only, no separate visible trigger — same shape as
// TagContextMenu, extended with Delete. Rename also lives on the row as a
// pencil icon (see PeoplePanel.tsx); keeping it here too mirrors how a tag's
// own right-click menu offers Rename alongside its pencil icon.
export function PersonContextMenu({
  onRename,
  onDelete,
  children
}: PersonContextMenuProps): ReactElement {
  return (
    <Menu shadow="md" width={180}>
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
