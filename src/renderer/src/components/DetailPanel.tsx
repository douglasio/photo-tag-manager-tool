import {
  ActionIcon,
  ActionIconGroup,
  Box,
  Button,
  Center,
  DataList,
  Flex,
  Group,
  Stack,
  Text,
  Title,
  Tooltip
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { FileNameEditor } from './FileNameEditor'
import { TagList } from './TagList'
import { isNullOrEmpty } from '@renderer/utils/functions'
import { IconCopy, IconExternalLink, IconPhoto } from '@tabler/icons-react'
import { useHover } from '@mantine/hooks'

// function formatBytes(bytes: number): string {
//   if (bytes < 1024) return `${bytes} B`
//   const units = ['KB', 'MB', 'GB']
//   let value = bytes / 1024
//   let unitIndex = 0
//   while (value >= 1024 && unitIndex < units.length - 1) {
//     value /= 1024
//     unitIndex++
//   }
//   return `${value.toFixed(1)} ${units[unitIndex]}`
// }

// function DetailRow({ label, value }: { label: string; value: string }): ReactElement {
//   return (
//     <Group justify="space-between" wrap="nowrap" gap="md" align="flex-start">
//       <Text c="dimmed" style={{ flexShrink: 0 }}>
//         {label}
//       </Text>
//       <Text ta="right" style={{ wordBreak: 'break-word' }}>
//         {value}
//       </Text>
//     </Group>
//   )
// }

const metadataDisplayFilters = ['comment']

export function DetailPanel(): ReactElement {
  const { selectedPhoto, allTags, updateTags, renameFile, openPhotoTab } = usePhotoLibrary()
  const { hovered, ref } = useHover<HTMLDivElement>()

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
        <Group justify="space-between" wrap="nowrap" align="center" gap="sm">
          <Box flex={1} miw={0}>
            <FileNameEditor
              fileName={selectedPhoto.fileName}
              onRename={(newBaseName) => renameFile(selectedPhoto.filePath, newBaseName)}
            />
          </Box>
          <Tooltip label="Open">
            <Button
              leftSection={<IconPhoto size={18} />}
              onClick={() => openPhotoTab(selectedPhoto.filePath)}
            >
              Open
            </Button>
          </Tooltip>
        </Group>
        {metadata.comment.value && (
          <DataList orientation="vertical">
            <DataList.Item>
              <DataList.ItemLabel>{metadata.comment.label}</DataList.ItemLabel>
              <DataList.ItemValue>{metadata.comment.displayValue}</DataList.ItemValue>
            </DataList.Item>
          </DataList>
        )}
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
