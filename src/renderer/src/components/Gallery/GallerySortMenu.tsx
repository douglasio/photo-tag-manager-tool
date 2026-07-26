import { ActionIcon, Box, Menu, Tooltip } from '@mantine/core'
import { IconArrowsSort, IconCheck } from '@tabler/icons-react'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../../state/PhotoLibraryContext'

export function GallerySortMenu(): ReactElement {
  const { state, setSort } = usePhotoLibrary()

  return (
    <Menu shadow="md" position="bottom-end">
      <Menu.Target>
        <Tooltip label="Sort">
          <ActionIcon variant="subtle" aria-label="Sort">
            <IconArrowsSort size={16} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Sort by</Menu.Label>
        <Menu.Item
          leftSection={
            state.sortBy === 'name' && state.sortOrder === 'asc' ? (
              <IconCheck size={14} />
            ) : (
              <Box w={14} />
            )
          }
          onClick={() => setSort('name', 'asc')}
        >
          Name (A–Z)
        </Menu.Item>
        <Menu.Item
          leftSection={
            state.sortBy === 'name' && state.sortOrder === 'desc' ? (
              <IconCheck size={14} />
            ) : (
              <Box w={14} />
            )
          }
          onClick={() => setSort('name', 'desc')}
        >
          Name (Z–A)
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={
            state.sortBy === 'dateTaken' && state.sortOrder === 'desc' ? (
              <IconCheck size={14} />
            ) : (
              <Box w={14} />
            )
          }
          onClick={() => setSort('dateTaken', 'desc')}
        >
          Date taken (Newest)
        </Menu.Item>
        <Menu.Item
          leftSection={
            state.sortBy === 'dateTaken' && state.sortOrder === 'asc' ? (
              <IconCheck size={14} />
            ) : (
              <Box w={14} />
            )
          }
          onClick={() => setSort('dateTaken', 'asc')}
        >
          Date taken (Oldest)
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
