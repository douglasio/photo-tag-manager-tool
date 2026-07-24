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
  Title,
  Tooltip
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../../state/PhotoLibraryContext'
import { CommentEditor } from './CommentEditor'
import { DateTakenEditor } from './DateTakenEditor'
import { FileNameEditor } from './FileNameEditor'
import { TagList } from '../Tags/TagList'
import { isNullOrEmpty } from '@renderer/utils/functions'
import { IconCopy, IconExternalLink, IconPhoto } from '@tabler/icons-react'
import { useHover } from '@mantine/hooks'

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

  // Showing one photo's metadata/tags while a multi-selection is active
  // would misleadingly suggest edits apply to just that one photo (batch
  // edits go through the gallery's right-click menu instead), so this stays
  // blank whenever more than one photo is selected.
  if (state.selectedPaths.size > 1) {
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

  return (
    <Stack>
      <Stack>
        <Tooltip label="Open">
          <Button
            leftSection={<IconPhoto size={18} />}
            onClick={() => openPhotoTab(selectedPhoto.filePath)}
          >
            Open
          </Button>
        </Tooltip>
        <Box flex={1} miw={0}>
          <FileNameEditor
            fileName={selectedPhoto.fileName}
            onRename={(newBaseName) => renameFile(selectedPhoto.filePath, newBaseName)}
          />
        </Box>
        <Stack>
          <Title order={6} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Comment
          </Title>
          <CommentEditor
            value={metadata.comment.value}
            displayValue={metadata.comment.displayValue}
            onSave={(comment) => updateComment(selectedPhoto.filePath, comment)}
          />
        </Stack>
        <Stack>
          <Title order={6} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Tags
          </Title>
          <TagList
            tags={selectedPhoto.tags}
            allTags={allTags}
            onChange={(tags) => void updateTags(selectedPhoto.filePath, tags)}
          />
        </Stack>
        <Stack>
          <Title order={6} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Metadata
          </Title>
          <DataList orientation="vertical">
            <DataList.Item>
              <DataList.ItemLabel>{metadata.dateTaken.label}</DataList.ItemLabel>
              <DataList.ItemValue>
                <DateTakenEditor
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
