import { type ReactElement, type ReactNode, useState } from 'react'

import { Box, Menu, MultiSelect, Text } from '@mantine/core'
import {
  IconEdit,
  IconExternalLink,
  IconFolderOpen,
  IconRotate,
  IconRotateClockwise,
  IconTag,
  IconTrash,
  IconUserOff
} from '@tabler/icons-react'

import { ConfirmDialog } from '@components'
import { type PhotoRecord, ROTATABLE_FORMATS } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { isMac } from '@utils'

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
  const {
    openPhotoTab,
    allTags,
    updateTags,
    selectPhoto,
    addTagsToSelection,
    rotatePhoto,
    deletePhotos,
    getFacesForPhoto,
    unassignFace,
    state
  } = usePhotoLibrary()
  const [opened, setOpened] = useState(false)
  const [addingTag, setAddingTag] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const canRotate = ROTATABLE_FORMATS.includes(photo.metadata.format)

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

  const deleteTargets = isBatch ? Array.from(state.selectedPaths) : [photo.filePath]

  // Only meaningful while browsing a specific person's photos (see
  // PeoplePanel/GalleryGrid's filter) — "the person" wouldn't be well
  // defined otherwise on a photo that could have several people in it.
  const selectedPersonName = state.selectedPerson
    ? (state.people.find((person) => person.id === state.selectedPerson)?.name ?? 'this person')
    : null

  const handleNotThisPerson = async (): Promise<void> => {
    const personId = state.selectedPerson
    if (!personId) return
    for (const path of deleteTargets) {
      const faces = await getFacesForPhoto(path)
      for (const face of faces) {
        if (face.personId === personId) await unassignFace(face.id)
      }
    }
  }

  const handleDeleteConfirm = async (): Promise<void> => {
    setDeleting(true)
    try {
      await deletePhotos(deleteTargets)
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
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
            {selectedPersonName && (
              <Menu.Item
                leftSection={<IconUserOff size={14} />}
                onClick={() => void handleNotThisPerson()}
              >
                {isBatch
                  ? `Not ${selectedPersonName} (${state.selectedPaths.size} Photos)`
                  : `Not ${selectedPersonName}`}
              </Menu.Item>
            )}
            {!isBatch && (
              <Menu.Item
                leftSection={<IconFolderOpen size={14} />}
                onClick={() => window.api.showItemInFolder(photo.filePath)}
              >
                Show in {isMac ? 'Finder' : 'Explorer'}
              </Menu.Item>
            )}
            {!isBatch && canRotate && (
              <>
                <Menu.Item
                  leftSection={<IconRotate size={14} />}
                  onClick={() => void rotatePhoto(photo.filePath, 'left')}
                >
                  Rotate Left
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconRotateClockwise size={14} />}
                  onClick={() => void rotatePhoto(photo.filePath, 'right')}
                >
                  Rotate Right
                </Menu.Item>
              </>
            )}
            <Menu.Divider />
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => setConfirmingDelete(true)}
            >
              {isBatch ? `Delete ${state.selectedPaths.size} Photos` : 'Delete'}
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
      <ConfirmDialog
        title={isBatch ? `Delete ${deleteTargets.length} photos?` : 'Delete photo?'}
        opened={confirmingDelete}
        saving={deleting}
        confirmLabel="Delete"
        confirmColor="red"
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setConfirmingDelete(false)}
      >
        <Text>
          {isBatch
            ? `This moves ${deleteTargets.length} photos to the trash.`
            : `This moves "${photo.fileName}" to the trash.`}
        </Text>
        <Text c="dimmed" mt="xs">
          You can restore {isBatch ? 'them' : 'it'} from your system&apos;s trash if needed.
        </Text>
      </ConfirmDialog>
    </Menu>
  )
}
