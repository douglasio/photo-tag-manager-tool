import { Box, Menu, MultiSelect } from '@mantine/core'
import { IconEdit, IconExternalLink, IconFolderOpen, IconTag } from '@tabler/icons-react'
import { useState, type ReactElement, type ReactNode } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { isMac } from '../utils/platform'
import type { PhotoRecord } from '../../../shared/types'

interface PhotoContextMenuProps {
  photo: PhotoRecord
  onRename: () => void
  children: ReactNode
}

export function PhotoContextMenu({
  photo,
  onRename,
  children
}: PhotoContextMenuProps): ReactElement {
  const { openPhotoTab, allTags, updateTags } = usePhotoLibrary()
  const [opened, setOpened] = useState(false)
  const [addingTag, setAddingTag] = useState(false)

  const handleChange = (value: boolean): void => {
    setOpened(value)
    if (!value) setAddingTag(false)
  }

  return (
    // returnFocus disabled: Mantine's Menu normally returns focus to the
    // trigger element on close, which races the Rename item's freshly
    // mounted autoFocus TextInput and immediately blurs/closes it again.
    <Menu opened={opened} onChange={handleChange} shadow="md" width={220} returnFocus={false}>
      <Menu.ContextMenu>{children}</Menu.ContextMenu>
      <Menu.Dropdown>
        {addingTag ? (
          <Box p={4}>
            <MultiSelect
              data={allTags}
              placeholder="Add tags…"
              searchable
              autoFocus
              onChange={(values) => {
                const merged = Array.from(new Set([...photo.tags, ...values]))
                void updateTags(photo.filePath, merged)
              }}
            />
          </Box>
        ) : (
          <>
            <Menu.Item
              leftSection={<IconExternalLink size={14} />}
              onClick={() => openPhotoTab(photo.filePath)}
            >
              Open
            </Menu.Item>
            <Menu.Item leftSection={<IconEdit size={14} />} onClick={onRename}>
              Rename
            </Menu.Item>
            <Menu.Item
              closeMenuOnClick={false}
              leftSection={<IconTag size={14} />}
              onClick={() => setAddingTag(true)}
            >
              Add Tag
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFolderOpen size={14} />}
              onClick={() => window.api.showItemInFolder(photo.filePath)}
            >
              Show in {isMac ? 'Finder' : 'Explorer'}
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
