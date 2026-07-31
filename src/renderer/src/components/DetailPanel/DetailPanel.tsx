import { type ReactElement, useState } from 'react'

import {
  ActionIcon,
  ActionIconGroup,
  Box,
  Button,
  Center,
  DataList,
  Flex,
  Stack,
  Text,
  Tooltip
} from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconCopy, IconExternalLink, IconPhoto } from '@tabler/icons-react'

import { CommentField, DateTakenField, FileNameField, SectionTitle, TagList } from '@components'
import { isNullOrEmpty } from '@renderer/utils/functions'
import { usePhotoLibrary } from '@state'

const metadataDisplayFilters = ['comment', 'dateTaken']

export function DetailPanel(): ReactElement {
  const {
    selectedPhoto,
    allTags,
    updateTags,
    renameFile,
    updateDateTaken,
    updateComment,
    openPhotoTab,
    state
  } = usePhotoLibrary()
  const { hovered, ref } = useHover<HTMLDivElement>()
  const [editingFileName, setEditingFileName] = useState(false)

  // Showing one photo's metadata/tags while a multi-selection is active
  // would misleadingly suggest edits apply to just that one photo (batch
  // edits go through the gallery's right-click menu instead), so this stays
  // blank whenever more than one photo is selected — but only on the gallery
  // screen; a photo-view tab always has exactly one photo open regardless of
  // whatever multi-selection is lingering in the background gallery.
  if (state.activeTab === 'gallery' && state.selectedPaths.size > 1) {
    return (
      <Center h="100%">
        <Text c="dimmed" ta="center">
          {state.selectedPaths.size} photos selected
        </Text>
      </Center>
    )
  }

  if (!selectedPhoto) {
    return (
      <Center h="100%">
        <Text c="dimmed" ta="center">
          Select a photo
        </Text>
      </Center>
    )
  }

  const { metadata } = selectedPhoto
  // The panel is already showing this exact photo's details because it's
  // the open photo-view tab — opening it again would be a no-op, so the
  // button is redundant there (it stays for the gallery screen, where
  // selectedPhoto is just the selection cursor, not necessarily open yet).
  const isViewingThisPhoto = state.activeTab === selectedPhoto.filePath

  return (
    <Stack>
      <Stack>
        {!isViewingThisPhoto && (
          <Tooltip label="Open">
            <Button
              leftSection={<IconPhoto size={18} />}
              onClick={() => openPhotoTab(selectedPhoto.filePath)}
            >
              Open
            </Button>
          </Tooltip>
        )}
        <Box flex={1} miw={0}>
          <FileNameField
            fileName={selectedPhoto.fileName}
            editing={editingFileName}
            onStartEdit={() => setEditingFileName(true)}
            onStopEdit={() => setEditingFileName(false)}
            onRename={(newBaseName) => renameFile(selectedPhoto.filePath, newBaseName)}
            variant="panel"
          />
        </Box>
        <Stack>
          <SectionTitle>Comment</SectionTitle>
          <CommentField
            value={metadata.comment.value}
            displayValue={metadata.comment.displayValue}
            onSave={(comment) => updateComment(selectedPhoto.filePath, comment)}
          />
        </Stack>
        <Stack>
          <SectionTitle>Tags</SectionTitle>
          <TagList
            tags={selectedPhoto.tags}
            allTags={allTags}
            recentTags={state.recentTags}
            onChange={(tags) => void updateTags(selectedPhoto.filePath, tags)}
          />
        </Stack>
        <Stack>
          <SectionTitle>Metadata</SectionTitle>
          <DataList orientation="vertical">
            <DataList.Item>
              <DataList.ItemLabel>{metadata.dateTaken.label}</DataList.ItemLabel>
              <DataList.ItemValue>
                <DateTakenField
                  value={metadata.dateTaken.value}
                  displayValue={metadata.dateTaken.displayValue}
                  onSave={(isoDate) => updateDateTaken(selectedPhoto.filePath, isoDate)}
                />
              </DataList.ItemValue>
            </DataList.Item>
            {Object.entries(metadata)
              .filter(
                ([key, field]) =>
                  !metadataDisplayFilters.includes(key) && !isNullOrEmpty(field.value)
              )
              .map(([key, field]) => (
                <DataList.Item key={key}>
                  <DataList.ItemLabel>{field.label}</DataList.ItemLabel>
                  <DataList.ItemValue>{field.displayValue}</DataList.ItemValue>
                </DataList.Item>
              ))}
            <DataList.Item>
              <DataList.ItemLabel>Filepath</DataList.ItemLabel>
              <DataList.ItemValue>
                <Flex gap="sm" justify="space-between" ref={ref}>
                  {selectedPhoto.filePath}
                  <ActionIconGroup>
                    <ActionIcon
                      style={{
                        opacity: hovered ? 0.7 : 0
                      }}
                      onClick={() => {
                        void navigator.clipboard.writeText(selectedPhoto.filePath)
                        notifications.show({ color: 'teal', message: 'Copied path to clipboard' })
                      }}
                    >
                      <IconCopy />
                    </ActionIcon>
                    <ActionIcon
                      style={{
                        opacity: hovered ? 0.7 : 0
                      }}

                      onClick={() => window.api.showItemInFolder(selectedPhoto.filePath)}
                    >
                      <IconExternalLink />
                    </ActionIcon>
                  </ActionIconGroup>
                </Flex>
              </DataList.ItemValue>
            </DataList.Item>
          </DataList>
        </Stack>
      </Stack>
    </Stack>
  )
}
