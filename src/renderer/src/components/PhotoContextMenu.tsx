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
  const { openPhotoTab, allTags, updateTags, selectPhoto, addTagsToSelection, state } =
    usePhotoLibrary()
  const [opened, setOpened] = useState(false)
  const [addingTag, setAddingTag] = useState(false)

  // Right-clicking a photo that's part of the active multi-selection (2+
  // photos) operates on the whole batch; right-clicking anything else
  // collapses the selection to just that photo first, matching Finder's
  // convention, so the menu always operates on "what's actually selected."
  const isBatch = state.selectedPaths.has(photo.filePath) && state.selectedPaths.size > 1

  const handleChange = (value: boolean): void => {
    setOpened(value)
    if (!value) {
      setAddingTag(false)
      return
    }
    if (!state.selectedPaths.has(photo.filePath)) selectPhoto(photo.filePath)
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
              // Combobox portals its dropdown to the document body by
              // default, so clicking an option lands outside the Menu's own
              // DOM subtree — Menu's click-outside detection treats that as
              // "clicked outside" and closes itself (discarding the
              // selection) before onChange can register it. Keeping the
              // dropdown inline avoids that.
              comboboxProps={{ withinPortal: false }}
              onChange={(values) => {
                if (isBatch) {
                  void addTagsToSelection(values)
                } else {
                  const merged = Array.from(new Set([...photo.tags, ...values]))
                  void updateTags(photo.filePath, merged)
                }
              }}
            />
          </Box>
        ) : (
          <>
            {!isBatch && (
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
              </>
            )}
            <Menu.Item
              closeMenuOnClick={false}
              leftSection={<IconTag size={14} />}
              onClick={() => setAddingTag(true)}
            >
              {isBatch ? `Add Tag to ${state.selectedPaths.size} Photos` : 'Add Tag'}
            </Menu.Item>
            {!isBatch && (
              <Menu.Item
                leftSection={<IconFolderOpen size={14} />}
                onClick={() => window.api.showItemInFolder(photo.filePath)}
              >
                Show in {isMac ? 'Finder' : 'Explorer'}
              </Menu.Item>
            )}
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
