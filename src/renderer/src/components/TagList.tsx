import { Pill, Text } from '@mantine/core'
import type { ReactElement } from 'react'

interface TagListProps {
  tags: string[]
}

export function TagList({ tags }: TagListProps): ReactElement {
  if (tags.length === 0) {
    return <Text c="dimmed">No tags</Text>
  }

  return (
    <Pill.Group>
      {tags.map((tag) => (
        <Pill key={tag}>{tag}</Pill>
      ))}
    </Pill.Group>
  )
}
