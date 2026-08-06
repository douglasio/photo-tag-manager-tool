import { Button, Group, Stack } from '@mantine/core'
import { IconTagPlus } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { SectionTitle, TagList } from '@components'
import { type DisplayPhotoRecord, usePhotoLibrary } from '@state'

interface DetailPanelTagsProps {
  photo: DisplayPhotoRecord
  onOpenQuickTag: () => void
}

export function DetailPanelTags({ photo, onOpenQuickTag }: DetailPanelTagsProps): ReactElement {
  const { allTags, state, updateTags } = usePhotoLibrary()

  return (
    <Stack>
      <Group justify="space-between" wrap="nowrap">
        <SectionTitle>Tags</SectionTitle>
        <Button
          variant="outline"
          size="compact-sm"
          leftSection={<IconTagPlus size={14} />}
          onClick={onOpenQuickTag}
        >
          Quick Tag
        </Button>
      </Group>
      <TagList
        tags={photo.tags}
        allTags={allTags}
        recentTags={state.recentTags}
        onChange={(tags) => void updateTags(photo.filePath, tags)}
      />
    </Stack>
  )
}
