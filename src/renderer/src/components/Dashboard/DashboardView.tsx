import { Box, Divider, Group, SimpleGrid, Stack, Title } from '@mantine/core'
import { IconHistory, IconHome2, IconTags } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import {
  FeaturedTagWidget,
  TaggingProgressWidget,
  ThrowbackWidget,
  TopTagsWidget,
  TopViewedWidget,
  WelcomeWidget
} from '@components'
import DashboardWidget from '@renderer/components/Dashboard/DashboardWidget'
import { Widget } from '@shared/types'

// minmax (not a flat 1fr) — rows still match each other by default, but can
// grow past that floor for taller content (e.g. Throwback's Timeline), with
// the page itself scrolling instead of clipping.
const SECTION_ROW_HEIGHT = 'minmax(340px, auto)'

interface DashboardSectionData {
  id: string
  title: string
  icon: typeof IconHome2
  widgets: Widget[]
}

function DashboardSection({
  title,
  icon: Icon,
  widgets
}: Omit<DashboardSectionData, 'id'>): ReactElement {
  return (
    <Stack gap="sm">
      <Group gap={6}>
        <Icon size={16} color="var(--mantine-color-dimmed)" />
        <Title order={3} lts={0.5} tt="uppercase" size="sm" c="dimmed">
          {title}
        </Title>
      </Group>
      <Divider />
      <SimpleGrid cols={3} spacing="lg" autoRows={SECTION_ROW_HEIGHT}>
        {widgets.map((widget) => (
          <DashboardWidget key={widget.id} {...widget} />
        ))}
      </SimpleGrid>
    </Stack>
  )
}

export function DashboardView(): React.JSX.Element {
  const sections: DashboardSectionData[] = [
    {
      id: 'home',
      title: 'Home',
      icon: IconHome2,
      widgets: [
        { id: 'welcome', title: 'Welcome', component: <WelcomeWidget /> },
        { id: 'topViewed', title: 'Top Viewed Photos', component: <TopViewedWidget /> }
      ]
    },
    {
      id: 'tags',
      title: 'Tags',
      icon: IconTags,
      widgets: [
        {
          id: 'taggingProgress',
          title: 'Tagging Progress',
          component: <TaggingProgressWidget />,
          colSpan: 2
        },
        { id: 'featuredTag', title: 'Featured Tag', component: <FeaturedTagWidget /> },
        { id: 'topTags', title: 'Top Tags', component: <TopTagsWidget /> }
      ]
    },
    {
      id: 'history',
      title: 'History',
      icon: IconHistory,
      widgets: [{ id: 'throwback', title: 'Throwback', component: <ThrowbackWidget />, colSpan: 3 }]
    }
  ]

  return (
    <Box p="md" pb="xl" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <Stack gap="xl">
        {sections.map((section) => (
          <DashboardSection
            key={section.id}
            title={section.title}
            icon={section.icon}
            widgets={section.widgets}
          />
        ))}
      </Stack>
    </Box>
  )
}
