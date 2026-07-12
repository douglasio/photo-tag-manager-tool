import { Badge, Box, Group, Image, Stack, Text } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { activeHoverBackground } from '../utils/listItemStyles'
import { toThumbProtocolUrl } from '../../../shared/protocolUrls'
import type { PhotoRecord } from '../../../shared/types'

const COVER_SIZE = 28

// Descriptions can contain line breaks (edited via a multi-line textarea in the
// gallery header); collapse them to a single line for this compact list row.
function toOneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

interface TagRowProps {
  tag: string
  count: number
  description: string
  coverPhoto: PhotoRecord | undefined
  isActive: boolean
  onSelect: () => void
}

function TagRow({
  tag,
  count,
  description,
  coverPhoto,
  isActive,
  onSelect
}: TagRowProps): ReactElement {
  const { hovered, ref } = useHover<HTMLDivElement>()

  return (
    <Group
      ref={ref}
      onClick={onSelect}
      wrap="nowrap"
      gap="xs"
      p={4}
      style={{
        cursor: 'pointer',
        borderRadius: 'var(--mantine-radius-default)',
        backgroundColor: activeHoverBackground(isActive, hovered)
      }}
    >
      <Box
        w={COVER_SIZE}
        h={COVER_SIZE}
        style={{
          flexShrink: 0,
          borderRadius: 'var(--mantine-radius-sm)',
          overflow: 'hidden',
          backgroundColor: 'var(--mantine-color-default)'
        }}
      >
        {coverPhoto?.thumbnailStatus === 'ready' && coverPhoto.thumbnailKey && (
          <Image
            src={toThumbProtocolUrl(coverPhoto.thumbnailKey)}
            w={COVER_SIZE}
            h={COVER_SIZE}
            fit="cover"
          />
        )}
      </Box>
      <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
        <Text truncate="end" fw={isActive ? 700 : 400}>
          {tag}
        </Text>
        {description && (
          <Text truncate="end" size="xs" c="dimmed">
            {toOneLine(description)}
          </Text>
        )}
      </Stack>
      <Badge circle variant={isActive ? 'filled' : 'light'} style={{ flexShrink: 0 }}>
        {count}
      </Badge>
    </Group>
  )
}

export function TagPanel(): ReactElement {
  const { allTags, tagCounts, tagCoverPhotos, state, setTagFilter } = usePhotoLibrary()

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
            description={state.tagDescriptions.get(tag) ?? ''}
            coverPhoto={tagCoverPhotos.get(tag)}
            isActive={isActive}
            onSelect={() => setTagFilter(isActive ? null : tag)}
          />
        )
      })}
    </Stack>
  )
}
