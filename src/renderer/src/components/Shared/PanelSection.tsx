import { ActionIcon, Box, Group, ScrollArea, Tooltip } from '@mantine/core'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'

import { SectionTitle } from './SectionTitle'

// The navbar's Splitter (App.tsx) forces a collapsed pane down to exactly
// this height — Mantine's own Splitter.collapse() always snaps a pane to 0
// (verified against its source, ignores `min` entirely), which would hide
// this header too and leave no way to re-expand it. Driving collapse
// ourselves via a fixed-px entry in Splitter's `sizes` array instead (see
// App.tsx) keeps this header's own height as the floor, so it stays visible
// and clickable. Kept in sync with the header's actual rendered height
// (16px vertical padding ×2 + ~24px content row) with a little slack.
export const PANEL_HEADER_HEIGHT = 60

interface PanelSectionProps {
  title: string
  headerAction?: ReactNode
  children: ReactNode
  // Accordion-style collapse toggle for the navbar's Splitter panes (Tags,
  // People, Folders) — omitted entirely by callers that don't need it, so
  // this stays a plain header everywhere else PanelSection is used.
  collapsed?: boolean
  onToggleCollapse?: () => void
}

/** One header + scrollable-content section of the app's left navbar (e.g. Tags, Folders). */
export function PanelSection({
  title,
  headerAction,
  children,
  collapsed,
  onToggleCollapse
}: PanelSectionProps): ReactElement {
  return (
    <Box p="md" flex={1} mih={0} display="flex" style={{ flexDirection: 'column' }}>
      <Group
        justify="space-between"
        wrap="nowrap"
        gap="xs"
        mb={collapsed ? 0 : 'xs'}
        style={{ flexShrink: 0 }}
      >
        <Group gap={4} wrap="nowrap">
          {onToggleCollapse && (
            <Tooltip label={collapsed ? 'Expand' : 'Collapse'}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={onToggleCollapse}
                aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
              >
                {collapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
              </ActionIcon>
            </Tooltip>
          )}
          <SectionTitle>{title}</SectionTitle>
        </Group>
        {headerAction}
      </Group>
      {!collapsed && (
        <Box flex={1} mih={0} style={{ overflowY: 'auto' }}>
          <ScrollArea>{children}</ScrollArea>
        </Box>
      )}
    </Box>
  )
}
