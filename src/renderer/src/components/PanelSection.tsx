import { Box, Group, Title } from '@mantine/core'
import type { ReactElement, ReactNode } from 'react'

interface PanelSectionProps {
  title: string
  headerAction?: ReactNode
  children: ReactNode
}

/** One header + scrollable-content section of the app's left navbar (e.g. Tags, Folders). */
export function PanelSection({ title, headerAction, children }: PanelSectionProps): ReactElement {
  return (
    <Box p="md" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between" wrap="nowrap" gap="xs" mb="xs" style={{ flexShrink: 0 }}>
        <Title order={6} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          {title}
        </Title>
        {headerAction}
      </Group>
      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</Box>
    </Box>
  )
}
