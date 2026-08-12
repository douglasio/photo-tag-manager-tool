import { useDraggable } from '@dnd-kit/core'
import { AspectRatio, BackgroundImage, Box, Stack, Text, UnstyledButton } from '@mantine/core'
import type { ReactElement } from 'react'

import { PhotoGradientOverlay, TagHoverCard } from '@components'
import { RADIUS_SIZE } from '@renderer/theme'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { PREVIEW_TRIGGER_KEY } from '@utils'

interface TagGridTileProps {
  tag: string
  count: number
  coverPhoto: PhotoRecord | undefined
  isActive: boolean
  // Only draggable once there's at least one group to drag it into — mirrors
  // TagListItem's own reasoning for the same prop.
  draggable: boolean
  onSelect: () => void
}

// Grid-view alternative to TagListItem's row — a square BackgroundImage tile
// with the tag name/count overlaid, per the roadmap's "2-column grid" spec.
// Draggable into a group like the row is; rename stays list-view-only (no
// natural home for that inline-editing UI on a bare tile).
export function TagGridTile({
  tag,
  count,
  coverPhoto,
  isActive,
  draggable,
  onSelect
}: TagGridTileProps): ReactElement {
  const hasThumbnail = coverPhoto?.thumbnailStatus === 'ready' && coverPhoto.thumbnailKey
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tag-drag:${tag}`,
    data: { tag },
    disabled: !draggable
  })

  const label = (
    <Stack gap={0} pos="absolute" bottom={0} left={0} right={0} p="xs" style={{ zIndex: 2 }}>
      <Text c={hasThumbnail ? 'white' : undefined} fw={700} truncate="end">
        #{tag}
      </Text>
      <Text c={hasThumbnail ? 'white' : 'dimmed'} size="xs">
        {count} photo{count === 1 ? '' : 's'}
      </Text>
    </Stack>
  )

  return (
    <TagHoverCard tag={tag}>
      <UnstyledButton
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={onSelect}
        // Space is the gallery's preview-trigger key, not a click here — see
        // TagListItem's identical guard for why.
        onKeyDown={(event) => {
          if (event.key === PREVIEW_TRIGGER_KEY) event.preventDefault()
        }}
        opacity={isDragging ? 0.4 : undefined}
        w="100%"
        bdrs={RADIUS_SIZE}
        pos="relative"
        style={{
          overflow: 'hidden',
          outline: isActive ? '2px solid var(--mantine-primary-color-filled)' : undefined,
          outlineOffset: -2
        }}
      >
        <AspectRatio ratio={1}>
          {hasThumbnail ? (
            <BackgroundImage
              src={toThumbProtocolUrl(coverPhoto.thumbnailKey!)}
              className="dashboard-photo-frame"
            >
              <PhotoGradientOverlay />
            </BackgroundImage>
          ) : (
            <Box bg="var(--mantine-primary-color-light)" />
          )}
        </AspectRatio>
        {label}
      </UnstyledButton>
    </TagHoverCard>
  )
}
