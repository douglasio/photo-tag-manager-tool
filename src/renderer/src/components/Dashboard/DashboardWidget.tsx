import React from 'react'

import { Paper, Stack, Title } from '@mantine/core'

import { Widget } from '@shared/types'

// widget wrapper
const DashboardWidget: React.FC<Widget> = ({ id, title, component }) => (
  <Paper withBorder p="md" id={id} h="100%">
    <Stack gap="sm" align="flex-start" justify="space-between">
      <Title order={2} lts={0.5} tt="uppercase" size="sm">
        {title}
      </Title>
      {component}
    </Stack>
  </Paper>
)

export default DashboardWidget
