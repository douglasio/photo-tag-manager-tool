import { Stack } from '@mantine/core'
import type { ReactElement } from 'react'

import { CommentField, SectionTitle } from '@components'
import { type DisplayPhotoRecord, usePhotoLibrary } from '@state'

interface DetailPanelCommentProps {
  photo: DisplayPhotoRecord
}

export function DetailPanelComment({ photo }: DetailPanelCommentProps): ReactElement {
  const { updateComment } = usePhotoLibrary()

  return (
    <Stack>
      <SectionTitle>Comment</SectionTitle>
      <CommentField
        value={photo.metadata.comment.value}
        displayValue={photo.metadata.comment.displayValue}
        onSave={(comment) => updateComment(photo.filePath, comment)}
      />
    </Stack>
  )
}
