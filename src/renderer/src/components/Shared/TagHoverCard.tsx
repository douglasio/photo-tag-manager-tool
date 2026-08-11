import { type ReactElement, type ReactNode, useEffect, useState } from 'react'

import { Popover, Stack, Text } from '@mantine/core'
import { useHover } from '@mantine/hooks'

import { usePhotoLibrary } from '@state'

const HOVER_DELAY_MS = 700

interface TagHoverCardContentProps {
  tag: string
  description?: string
}

// The shared name+description layout — reused directly by TagHoverCard below
// and by any trigger (e.g. TagListItem's own Tooltip) that needs its own
// hover/drag-aware wiring but shouldn't duplicate this content.
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

interface TagHoverCardProps {
  tag: string
  children: ReactNode
}

// Shared hover-popover for tag chips/badges throughout the app
export function TagHoverCard({ tag, children }: TagHoverCardProps): ReactElement {
  const { state } = usePhotoLibrary()
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

  const description = state.tagDescriptions.get(tag)

  return (
    <Popover opened={opened} withArrow shadow="md" position="top">
      <Popover.Target>
        <span ref={ref}>{children}</span>
      </Popover.Target>
      <Popover.Dropdown style={{ pointerEvents: 'none' }}>
        <TagHoverCardContent tag={tag} description={description} />
      </Popover.Dropdown>
    </Popover>
  )
}
