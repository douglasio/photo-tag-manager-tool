import { Group, Title } from '@mantine/core'
import type { TablerIcon } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'

import { ACTION_ICONS } from '@utils'

interface SectionTitleProps {
  children: ReactNode
  /** Rendered before the title at a consistent size and dimmed to match it. */
  icon?: TablerIcon
  /** Renders a step down in size, for a header nested inside another
   * section's content (e.g. "Suggested" within "Tags") rather than beside it. */
  sub?: boolean
}

/** Small uppercase, dimmed header used above a section's content (Settings, DetailPanel, PanelSection). */
export function SectionTitle({
  children,
  icon: Icon,
  sub = false
}: SectionTitleProps): ReactElement {
  const title = (
    <Title order={6} c="dimmed" tt="uppercase" lts="0.05em" fz={sub ? 'xs' : undefined}>
      {children}
    </Title>
  )

  if (!Icon) return title

  return (
    <Group gap="xs" wrap="nowrap">
      <Icon
        size={sub ? ACTION_ICONS.ICON_SIZE - 4 : ACTION_ICONS.ICON_SIZE}
        color="var(--mantine-color-dimmed)"
      />
      {title}
    </Group>
  )
}
