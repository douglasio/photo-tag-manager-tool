import { type ReactElement, type ReactNode, type RefObject, useEffect, useState } from 'react'

import { Card, Group, Image, Popover, Stack, Text, Tooltip } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { IconEye, IconPhoto } from '@tabler/icons-react'

import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { useSidebarLibrary } from '@state'
import { isPhotoDisplayable } from '@utils'

const HOVER_DELAY_MS = 700
const CARD_WIDTH = 320
const COVER_IMAGE_HEIGHT = 220
const STAT_ICON_SIZE = 14
// Neutralizes Tooltip's chrome (padding/background/shadow/radius) so
// only the Card inside it is visible — used by TagHoverCardTarget below.
const TRANSPARENT_TOOLTIP_STYLES = {
  tooltip: {
    padding: 0,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'var(--mantine-shadow-md)'
  }
}

interface TagHoverCardBodyProps {
  tag: string
  description?: string
  coverPhoto?: PhotoRecord
  photoCount: number
  viewCount: number
}

export function TagHoverCardBody({
  tag,
  description,
  coverPhoto,
  photoCount,
  viewCount
}: TagHoverCardBodyProps): ReactElement {
  const hasCoverImage = coverPhoto != null && isPhotoDisplayable(coverPhoto)

  return (
    <Card w={CARD_WIDTH} padding="sm">
      {hasCoverImage && (
        <Card.Section>
          <Image
            src={toThumbProtocolUrl(coverPhoto.thumbnailKey!)}
            alt={coverPhoto.fileName}
            h={COVER_IMAGE_HEIGHT}
            fit="cover"
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
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

// Shared by both components below — the four lookups TagHoverCardBody needs.
function useTagHoverCardBodyProps(tag: string): Omit<TagHoverCardBodyProps, 'tag'> {
  const { state, tagCounts, tagCoverPhotos, tagViewCounts } = useSidebarLibrary()
  return {
    description: state.tagDescriptions.get(tag),
    coverPhoto: tagCoverPhotos.get(tag),
    photoCount: tagCounts.get(tag) ?? 0,
    viewCount: tagViewCounts.get(tag) ?? 0
  }
}

interface TagHoverCardProps {
  tag: string
  children: ReactNode
}

// Shared hover-popover for tag chips/badges throughout the app.
export function TagHoverCard({ tag, children }: TagHoverCardProps): ReactElement {
  const bodyProps = useTagHoverCardBodyProps(tag)
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
        <TagHoverCardBody tag={tag} {...bodyProps} />
      </Popover.Dropdown>
    </Popover>
  )
}

interface TagHoverCardTargetProps {
  tag: string
  target: RefObject<HTMLElement | null>
  disabled?: boolean
}

// Same rich card as TagHoverCard, but positioned off an external ref instead
// of wrapping children — needed where wrapping would swallow events meant
// for the target itself (e.g. TagPanel's rows sit inside Menu.ContextMenu,
// which clones onContextMenu onto its direct child; a wrapper wouldn't
// forward that through). Tooltip (unlike Popover) supports a target ref
// natively, so this reuses that instead of hand-rolling the same thing.
export function TagHoverCardTarget({
  tag,
  target,
  disabled
}: TagHoverCardTargetProps): ReactElement | null {
  const bodyProps = useTagHoverCardBodyProps(tag)
  const [opened, setOpened] = useState(false)

  // Driven manually (mirrors TagHoverCard's own useHover+setTimeout above)
  // rather than Tooltip's built-in openDelay — target mode has no child to
  // attach a ref-callback hover hook to, so this attaches plain listeners to
  // the external ref instead, with the same delay/cancel behavior.
  useEffect(() => {
    if (disabled) return undefined
    const el = target.current
    if (!el) return undefined
    let timer: ReturnType<typeof setTimeout> | null = null
    const handleEnter = (): void => {
      timer = setTimeout(() => setOpened(true), HOVER_DELAY_MS)
    }
    const handleLeave = (): void => {
      if (timer) clearTimeout(timer)
      setOpened(false)
    }
    el.addEventListener('mouseenter', handleEnter)
    el.addEventListener('mouseleave', handleLeave)
    return () => {
      if (timer) clearTimeout(timer)
      el.removeEventListener('mouseenter', handleEnter)
      el.removeEventListener('mouseleave', handleLeave)
    }
  }, [target, disabled])

  // Mounted only while actually open — Tooltip drags in Popover/floating-ui
  // machinery whose render cost is paid per instance even when closed, and
  // this renders once per tag row (hundreds of them in a large library).
  // Hover detection lives in the effect above, not in Tooltip, so nothing is
  // lost by leaving it unmounted until then.
  if (!opened || disabled) return null

  return (
    <Tooltip
      target={target}
      opened
      position="right"
      withArrow
      multiline
      styles={TRANSPARENT_TOOLTIP_STYLES}
      label={<TagHoverCardBody tag={tag} {...bodyProps} />}
    />
  )
}
