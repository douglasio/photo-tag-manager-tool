import React from 'react'

import { Box, Group, Paper, Text, Title } from '@mantine/core'

import { Widget } from '@shared/types'
// widget wrapper — the content Box must itself be a flex column (not just a
// flex item of Paper) for a widget root using className="flex-fill" to have
// anything to resolve its height against; otherwise that widget's height
// falls back to auto and it stops constraining its own content.
const DashboardWidget: React.FC<Widget> = ({ id, title, description, component, colSpan }) => {
  return (
    <Paper
      p="md"
      id={id}
      h="100%"
      display="flex"
      bg="#282b4c"
      style={{
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
        ...(colSpan && colSpan > 1 && { gridColumn: `span ${colSpan}` })
      }}
    >
      {description ? (
        <Group align="center">
          <Title order={2} lts={0.5} tt="uppercase" size="sm" style={{ flexShrink: 0 }}>
            {title}
          </Title>
          <Text c="dimmed" size="sm" flex="0 0 auto">
            {description}
          </Text>
        </Group>
      ) : (
        <Title order={2} lts={0.5} tt="uppercase" size="sm" style={{ flexShrink: 0 }}>
          {title}
        </Title>
      )}
      <Box
        display="flex"
        w="100%"
        pt="sm"
        className="flex-fill"
        style={{ flexDirection: 'column' }}
      >
        {component}
      </Box>
    </Paper>
  )
}

export default DashboardWidget
