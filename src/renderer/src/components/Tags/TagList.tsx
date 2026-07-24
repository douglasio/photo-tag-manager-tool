import { TagsInput } from '@mantine/core'
import type { ReactElement } from 'react'

interface TagListProps {
  tags: string[]
  allTags: string[]
  onChange: (tags: string[]) => void
}

export function TagList({ tags, allTags, onChange }: TagListProps): ReactElement {
  return (
    <TagsInput
      value={tags}
      onChange={onChange}
      data={allTags}
      placeholder="Add a tag…"
      size="md"
      styles={{
        pill: {
          backgroundColor: 'var(--mantine-primary-color-light)'
        }
      }}
    />
  )
}
