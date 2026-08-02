import { Stack } from '@mantine/core'
import type { ReactElement } from 'react'

import { SectionTitle, TagList } from '@components'
import { type DisplayPhotoRecord, usePhotoLibrary } from '@state'

interface DetailPanelTagsProps {
  photo: DisplayPhotoRecord
}

export function DetailPanelTags({ photo }: DetailPanelTagsProps): ReactElement {
  const { allTags, state, updateTags } = usePhotoLibrary()

  return (
    <Stack>
      <SectionTitle>Tags</SectionTitle>
      <TagList
        tags={photo.tags}
        allTags={allTags}
        recentTags={state.recentTags}
        onChange={(tags) => void updateTags(photo.filePath, tags)}
      />
    </Stack>
  )
}
