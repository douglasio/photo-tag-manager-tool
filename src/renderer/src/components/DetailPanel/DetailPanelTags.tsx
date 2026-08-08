import { Button, Group, Stack } from '@mantine/core'
import { IconTagPlus } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { SectionTitle, SuggestedTagsRow, TagList } from '@components'
import { useTagSuggestions } from '@hooks'
import { type DisplayPhotoRecord, usePhotoLibrary } from '@state'

interface DetailPanelTagsProps {
  photo: DisplayPhotoRecord
  onOpenQuickTag: () => void
}

export function DetailPanelTags({ photo, onOpenQuickTag }: DetailPanelTagsProps): ReactElement {
  const { allTags, state, updateTags } = usePhotoLibrary()
  const { suggestions, loading } = useTagSuggestions(
    photo.filePath,
    photo.tags,
    state.aiTagSuggestionsEnabled
  )

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
      <SuggestedTagsRow
        suggestions={suggestions}
        loading={loading}
        onAccept={(tag) => void updateTags(photo.filePath, [...photo.tags, tag])}
      />
      <TagList
        tags={photo.tags}
        allTags={allTags}
        recentTags={state.recentTags}
        onChange={(tags) => void updateTags(photo.filePath, tags)}
      />
    </Stack>
  )
}
