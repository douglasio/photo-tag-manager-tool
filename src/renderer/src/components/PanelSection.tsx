import { Box, Title } from '@mantine/core'
import type { ReactElement, ReactNode } from 'react'

interface PanelSectionProps {
  title: string
  children: ReactNode
}

/** One header + scrollable-content section of the app's left navbar (e.g. Tags, Folders). */
export function PanelSection({ title, children }: PanelSectionProps): ReactElement {
  return (
    <Box p="md" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Title
        order={6}
        c="dimmed"
        tt="uppercase"
        style={{ letterSpacing: '0.05em', flexShrink: 0 }}
        mb="xs"
      >
        {title}
      </Title>
      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</Box>
    </Box>
  )
}
