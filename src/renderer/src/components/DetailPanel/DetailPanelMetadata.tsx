import { type ReactElement, useState } from 'react'

import {
  ActionIcon,
  ActionIconGroup,
  Collapse,
  DataList,
  Flex,
  Group,
  Stack,
  Text,
  Tooltip,
  UnstyledButton
} from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconChevronDown, IconChevronRight, IconCopy, IconExternalLink } from '@tabler/icons-react'

import { DateTakenField, SectionTitle } from '@components'
import { isNullOrEmpty } from '@renderer/utils/functions'
import { type DisplayPhotoRecord, usePhotoLibrary } from '@state'

const metadataDisplayFilters = ['comment', 'dateTaken']

interface DetailPanelMetadataProps {
  photo: DisplayPhotoRecord
}

export function DetailPanelMetadata({ photo }: DetailPanelMetadataProps): ReactElement {
  const { updateDateTaken } = usePhotoLibrary()
  const { hovered, ref } = useHover<HTMLDivElement>()
  const { metadata } = photo
  // Session-only, and deliberately not keyed on the photo — this component
  // stays mounted across selection changes, so the choice sticks while you
  // step through photos and resets on next launch.
  const [expanded, setExpanded] = useState(true)

  return (
    <Stack>
      <UnstyledButton
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse metadata' : 'Expand metadata'}
      >
        <Group gap={4} wrap="nowrap">
          {expanded ? (
            <IconChevronDown size={14} color="var(--mantine-color-dimmed)" />
          ) : (
            <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />
          )}
          <SectionTitle>Metadata</SectionTitle>
        </Group>
      </UnstyledButton>
      <Collapse expanded={expanded}>
        <DataList orientation="vertical">
          <DataList.Item>
            <DataList.ItemLabel>{metadata.dateTaken.label}</DataList.ItemLabel>
            <DataList.ItemValue>
              <DateTakenField
                value={metadata.dateTaken.value}
                displayValue={metadata.dateTaken.displayValue}
                onSave={(isoDate) => updateDateTaken(photo.filePath, isoDate)}
              />
            </DataList.ItemValue>
          </DataList.Item>
          {Object.entries(metadata)
            .filter(
              ([key, field]) => !metadataDisplayFilters.includes(key) && !isNullOrEmpty(field.value)
            )
            .map(([key, field]) => (
              <DataList.Item key={key}>
                <DataList.ItemLabel>{field.label}</DataList.ItemLabel>
                <DataList.ItemValue>{field.displayValue}</DataList.ItemValue>
              </DataList.Item>
            ))}
          <DataList.Item>
            <DataList.ItemLabel>Filepath</DataList.ItemLabel>
            <DataList.ItemValue w="100%">
              <Flex gap="sm" justify="space-between" align="center" ref={ref}>
                <Tooltip label={photo.filePath}>
                  <Text truncate="start" flex={1} miw={0}>
                    {photo.filePath}
                  </Text>
                </Tooltip>
                <ActionIconGroup>
                  <ActionIcon
                    style={{ opacity: hovered ? 0.7 : 0 }}
                    onClick={() => {
                      void navigator.clipboard.writeText(photo.filePath)
                      notifications.show({ color: 'teal', message: 'Copied path to clipboard' })
                    }}
                  >
                    <IconCopy />
                  </ActionIcon>
                  <ActionIcon
                    style={{ opacity: hovered ? 0.7 : 0 }}
                    onClick={() => window.api.showItemInFolder(photo.filePath)}
                  >
                    <IconExternalLink />
                  </ActionIcon>
                </ActionIconGroup>
              </Flex>
            </DataList.ItemValue>
          </DataList.Item>
        </DataList>
      </Collapse>
    </Stack>
  )
}
