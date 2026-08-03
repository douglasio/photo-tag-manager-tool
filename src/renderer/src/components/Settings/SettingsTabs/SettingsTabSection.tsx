import React from 'react'

import { Paper, Title } from '@mantine/core'

interface SettingsTabSectionProps {
  title?: string
  children?: React.ReactNode
}

const SettingsTabSection: React.FC<SettingsTabSectionProps> = ({ title, children }) => {
  return (
    <Paper p="md" withBorder>
      {title && (
        <Title order={6} c="dimmed" tt="uppercase" lts="0.05em" mb="md">
          {title}
        </Title>
      )}
      {children}
    </Paper>
  )
}

export default SettingsTabSection
