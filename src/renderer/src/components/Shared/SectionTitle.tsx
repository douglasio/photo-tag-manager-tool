import { Title } from '@mantine/core'
import type { ReactElement, ReactNode } from 'react'

interface SectionTitleProps {
  children: ReactNode
}

/** Small uppercase, dimmed header used above a section's content (Settings, DetailPanel, PanelSection). */
export function SectionTitle({ children }: SectionTitleProps): ReactElement {
  return (
    <Title order={6} c="dimmed" tt="uppercase" lts="0.05em">
      {children}
    </Title>
  )
}
