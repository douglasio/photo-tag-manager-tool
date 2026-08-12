import { type ReactElement, type ReactNode, useEffect, useState } from 'react'

import { Card, Group, Image, Popover, Stack, Text } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { IconEye, IconPhoto } from '@tabler/icons-react'

import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'

const HOVER_DELAY_MS = 700
const CARD_WIDTH = 220
const COVER_IMAGE_HEIGHT = 120
const STAT_ICON_SIZE = 14

interface TagHoverCardContentProps {
  tag: string
  description?: string
}

// The plain name+description layout — used by TagPanel's own Tooltip, a
// lighter-weight interaction than the full card below, so it stays text-only.
export function TagHoverCardContent({ tag, description }: TagHoverCardContentProps): ReactElement {
  return description ? (
    <Stack gap={2}>
      <Text size="sm" fw={600}>
        #{tag}
      </Text>
      <Text size="xs" c="dimmed">
        {description}
      </Text>
    </Stack>
  ) : (
    <Text size="sm" fw={600}>
      #{tag}
    </Text>
  )
}

interface TagHoverCardBodyProps {
  tag: string
  description?: string
  coverPhoto?: PhotoRecord
  photoCount: number
  viewCount: number
}

// The full popover card — cover photo on top, tag name + description as the
// body, and total photo/view counts as a footer section. Kept as its own
// component (rather than inlined in TagHoverCard below) so it's directly
// unit-testable: Mantine's Popover.Dropdown renders through a floating-ui
// portal that never actually settles/mounts under jsdom.
export function TagHoverCardBody({
  tag,
  description,
  coverPhoto,
  photoCount,
  viewCount
}: TagHoverCardBodyProps): ReactElement {
  const hasCoverImage = coverPhoto?.thumbnailStatus === 'ready' && !!coverPhoto.thumbnailKey

  return (
    <Card w={CARD_WIDTH} padding="sm" radius={0}>
      {hasCoverImage && (
        <Card.Section>
          <Image
            src={toThumbProtocolUrl(coverPhoto.thumbnailKey!)}
            alt={coverPhoto.fileName}
            h={COVER_IMAGE_HEIGHT}
            fit="cover"
          />
        </Card.Section>
      )}
      <Stack gap={2} mt={hasCoverImage ? 'sm' : 0}>
        <Text size="sm" fw={600}>
          #{tag}
        </Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
      <Card.Section withBorder inheritPadding mt="sm" py="xs">
        <Group justify="space-between">
          <Group gap={4} c="dimmed">
            <IconPhoto size={STAT_ICON_SIZE} />
            <Text size="xs">{photoCount}</Text>
          </Group>
          <Group gap={4} c="dimmed">
            <IconEye size={STAT_ICON_SIZE} />
            <Text size="xs">{viewCount}</Text>
          </Group>
        </Group>
      </Card.Section>
    </Card>
  )
}

interface TagHoverCardProps {
  tag: string
  children: ReactNode
}

// Shared hover-popover for tag chips/badges throughout the app.
export function TagHoverCard({ tag, children }: TagHoverCardProps): ReactElement {
  const { state, tagCounts, tagCoverPhotos, tagViewCounts } = usePhotoLibrary()
  const { hovered, ref } = useHover<HTMLSpanElement>()
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    if (!hovered) return undefined
    const timer = setTimeout(() => setOpened(true), HOVER_DELAY_MS)
    return () => {
      clearTimeout(timer)
      setOpened(false)
    }
  }, [hovered])

  return (
    <Popover opened={opened} withArrow shadow="md" position="top">
      <Popover.Target>
        <span ref={ref}>{children}</span>
      </Popover.Target>
      <Popover.Dropdown p={0} style={{ pointerEvents: 'none', overflow: 'hidden' }}>
        <TagHoverCardBody
          tag={tag}
          description={state.tagDescriptions.get(tag)}
          coverPhoto={tagCoverPhotos.get(tag)}
          photoCount={tagCounts.get(tag) ?? 0}
          viewCount={tagViewCounts.get(tag) ?? 0}
        />
      </Popover.Dropdown>
    </Popover>
  )
}
