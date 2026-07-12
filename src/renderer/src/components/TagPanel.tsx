import { Badge, Button, Group, Stack, Text } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { activeHoverBackground } from '../utils/listItemStyles'

interface TagRowProps {
  tag: string
  count: number
  isActive: boolean
  onClick: () => void
}

function TagRow({ tag, count, isActive, onClick }: TagRowProps): ReactElement {
  const { hovered, ref } = useHover<HTMLButtonElement>()

  return (
    <Button
      ref={ref}
      onClick={onClick}
      bg={activeHoverBackground(isActive, hovered)}
      w="100%"
      variant="transparent"
      justify="left"
    >
      <Group gap={6} wrap="nowrap" p={4}>
        <Text truncate="end" miw={0} flex="1">
          {tag}
        </Text>
        <Badge circle variant={isActive ? 'filled' : 'light'}>
          {count}
        </Badge>
      </Group>
    </Button>
  )
}

export function TagPanel(): ReactElement {
  const { allTags, tagCounts, state, setTagFilter } = usePhotoLibrary()

  if (allTags.length === 0) {
    return <Text c="dimmed">No tags yet.</Text>
  }

  return (
    <Stack gap={4}>
      {allTags.map((tag) => {
        const isActive = state.selectedTag === tag
        return (
          <TagRow
            key={tag}
            tag={tag}
            count={tagCounts.get(tag) ?? 0}
            isActive={isActive}
            onClick={() => setTagFilter(isActive ? null : tag)}
          />
        )
      })}
    </Stack>
  )
}
