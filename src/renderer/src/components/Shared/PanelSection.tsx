import { Box, Group } from '@mantine/core'
import type { ReactElement, ReactNode } from 'react'

import { SectionTitle } from './SectionTitle'

interface PanelSectionProps {
  title: string
  headerAction?: ReactNode
  children: ReactNode
}

/** One header + scrollable-content section of the app's left navbar (e.g. Tags, Folders). */
export function PanelSection({ title, headerAction, children }: PanelSectionProps): ReactElement {
  return (
    <Box p="md" flex={1} mih={0} display="flex" style={{ flexDirection: 'column' }}>
      <Group justify="space-between" wrap="nowrap" gap="xs" mb="xs" style={{ flexShrink: 0 }}>
        <SectionTitle>{title}</SectionTitle>
        {headerAction}
      </Group>
      <Box flex={1} mih={0} style={{ overflowY: 'auto' }}>
        {children}
      </Box>
    </Box>
  )
}
