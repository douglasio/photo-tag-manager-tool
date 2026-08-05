import React from 'react'

import { Box, Paper, Title } from '@mantine/core'

import { Widget } from '@shared/types'

// widget wrapper — Paper must actually be a flex column (and have a
// resolved height, via h="100%" from the SimpleGrid cell it sits in) for the
// content Box's flex={1}/mih={0} below to do anything. Without that, the Box
// falls back to height:auto, and any widget using h="100%" internally (e.g.
// TopViewedWidget's chart) resolves against nothing and collapses to 0.
const DashboardWidget: React.FC<Widget> = ({ id, title, component, colSpan }) => (
  <Paper
    withBorder
    p="md"
    id={id}
    h="100%"
    display="flex"
    style={{
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
      ...(colSpan && colSpan > 1 && { gridColumn: `span ${colSpan}` })
    }}
  >
    <Title order={2} lts={0.5} tt="uppercase" size="sm" style={{ flexShrink: 0 }}>
      {title}
    </Title>
    <Box flex={1} mih={0} w="100%" pt="sm">
      {component}
    </Box>
  </Paper>
)

export default DashboardWidget
