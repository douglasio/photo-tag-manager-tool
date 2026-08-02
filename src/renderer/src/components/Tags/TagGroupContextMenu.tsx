import { ActionIcon, Box, Menu } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { IconEdit, IconSettings, IconTrash, IconWand } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'

interface TagGroupContextMenuProps {
  onRename: () => void
  onEditPattern: () => void
  onDelete: () => void
  children: ReactNode
}

export function TagGroupContextMenu({
  onRename,
  onEditPattern,
  onDelete,
  children
}: TagGroupContextMenuProps): ReactElement {
  // Tracked on the wrapping Box (not the row itself) — the cog sits
  // absolutely positioned on top of the row, so hovering onto it would
  // otherwise fire mouseleave on the row and hide the cog out from under
  // the cursor right as it's reached.
  const { hovered, ref } = useHover<HTMLDivElement>()

  return (
    <Menu shadow="md" width={200}>
      {/* The cog sits beside (not inside) the row — Accordion.Control is
          itself a button, and a button can't nest another interactive
          control, so this is a positioned sibling instead. */}
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
            aria-label="Group options"
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
        <Menu.Item leftSection={<IconWand size={14} />} onClick={onEditPattern}>
          Edit auto-add rule
        </Menu.Item>
        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
