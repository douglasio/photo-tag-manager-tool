import { ActionIcon, ActionIconGroup, DataList, Flex, Stack } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconCopy, IconExternalLink } from '@tabler/icons-react'
import type { ReactElement } from 'react'

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

  return (
    <Stack>
      <SectionTitle>Metadata</SectionTitle>
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
          <DataList.ItemValue>
            <Flex gap="sm" justify="space-between" ref={ref}>
              {photo.filePath}
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
    </Stack>
  )
}
