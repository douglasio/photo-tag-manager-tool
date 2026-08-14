import { ActionIcon, Box, Menu } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { IconEdit, IconSettings, IconTrash } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'

interface PersonContextMenuProps {
  onRename: () => void
  onDelete: () => void
  children: ReactNode
}

// Mirrors TagGroupContextMenu's hover-icon-beside-the-row pattern — one menu
// item lighter than that one (no auto-add-rule equivalent for people).
export function PersonContextMenu({
  onRename,
  onDelete,
  children
}: PersonContextMenuProps): ReactElement {
  const { hovered, ref } = useHover<HTMLDivElement>()

  return (
    <Menu shadow="md" width={180}>
      <Box pos="relative" ref={ref}>
        <Menu.ContextMenu>{children}</Menu.ContextMenu>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            pos="absolute"
            top="50%"
            right={36}
            style={{ transform: 'translateY(-50%)' }}
            opacity={hovered ? 0.7 : 0}
            aria-label="Person options"
            onClick={(event) => event.stopPropagation()}
          >
            <IconSettings size={16} />
          </ActionIcon>
        </Menu.Target>
      </Box>
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
