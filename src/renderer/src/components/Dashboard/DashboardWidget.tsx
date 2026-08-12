import React, { useRef } from 'react'

import { Box, Group, Paper, Text, Title } from '@mantine/core'

import { Widget } from '@shared/types'

import { DashboardPreviewZoomProvider } from './DashboardPreviewZoomContext'
// widget wrapper — the content Box must itself be a flex column, not just a
// flex item of Paper, for a "flex-fill" widget root to have a height to resolve against.
const DashboardWidget: React.FC<Widget> = ({ id, title, description, component, colSpan }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  return (
    <Paper
      p="md"
      id={id}
      h="100%"
      display="flex"
      bg="dark"
      shadow="xs"
      radius="md"
      style={{
        flexDirection: 'column',
        // overflowX: 'hidden',
        // overflowY: 'auto', // disabled — see DashboardView's row-height fix instead
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
        ref={contentRef}
        display="flex"
        w="100%"
        pt="sm"
        className="flex-fill"
        style={{ flexDirection: 'column' }}
      >
        <DashboardPreviewZoomProvider containerRef={contentRef}>
          {component}
        </DashboardPreviewZoomProvider>
      </Box>
    </Paper>
  )
}

export default DashboardWidget
