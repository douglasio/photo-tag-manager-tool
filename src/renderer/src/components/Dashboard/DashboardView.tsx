import { Box, Button, Divider, EmptyState, Group, SimpleGrid, Stack, Title } from '@mantine/core'
import { IconHistory, IconHome2, IconLibraryPhoto, IconTags } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import {
  FeaturedTagWidget,
  PhotosFromYearWidget,
  RecentlyAddedWidget,
  TaggingProgressWidget,
  TagThisPhotoWidget,
  TimeWarpWidget,
  TopTagsWidget,
  TopViewedWidget,
  WelcomeWidget
} from '@components'
import DashboardWidget from '@renderer/components/Dashboard/DashboardWidget'
import { Widget } from '@shared/types'
import { usePhotoLibrary } from '@state'

// minmax (not 1fr) — rows match by default, but can grow for tall content
// (e.g. Throwback's Timeline), with the page scrolling instead of clipping.
const SECTION_ROW_HEIGHT = 'minmax(340px, auto)'
// A flat (not minmax/auto) height, roughly a third of the viewport — unlike
// auto+overflow:hidden, this gives every h="100%" descendant (e.g.
// BarChart) a real height to resolve against instead of clipping after the fact.
const SECTION_MAX_HEIGHT = '33vh'

interface DashboardSectionData {
  id: string
  title: string
  icon: typeof IconHome2
  widgets: Widget[]
  // Off by default — History's Throwback widget is allowed to grow past a
  // fixed bound (a big Timeline needs the room), page scrolling instead.
  capped?: boolean
}

function DashboardSection({
  title,
  icon: Icon,
  widgets,
  capped
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
      <SimpleGrid cols={3} spacing="lg" autoRows={capped ? SECTION_MAX_HEIGHT : SECTION_ROW_HEIGHT}>
        {widgets.map((widget) => (
          <DashboardWidget key={widget.id} {...widget} />
        ))}
      </SimpleGrid>
    </Stack>
  )
}

export function DashboardView(): React.JSX.Element {
  const { activePhotosByPath, addFolder } = usePhotoLibrary()

  const sections: DashboardSectionData[] = [
    {
      id: 'home',
      title: 'Home',
      icon: IconHome2,
      capped: true,
      widgets: [
        { id: 'welcome', title: 'Welcome', component: <WelcomeWidget /> },
        { id: 'topViewed', title: 'Top Viewed Photos', component: <TopViewedWidget /> },
        { id: 'recentlyAdded', title: 'Recently Added', component: <RecentlyAddedWidget /> }
      ]
    },
    {
      id: 'tags',
      title: 'Tags',
      icon: IconTags,
      capped: true,
      widgets: [
        { id: 'taggingProgress', title: 'Tagging Progress', component: <TaggingProgressWidget /> },
        {
          id: 'tagThisPhoto',
          title: 'Tag This Photo',
          component: <TagThisPhotoWidget />,
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
      widgets: [
        { id: 'timeWarp', title: 'Time Warp', component: <TimeWarpWidget />, colSpan: 1 },
        { id: 'photosFromYear', title: 'Photos From Year', component: <PhotosFromYearWidget /> }
      ]
    }
  ]

  if (activePhotosByPath.size === 0) {
    return (
      <Box
        flex="1"
        mih={0}
        display="flex"
        style={{
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <EmptyState
          icon={<IconLibraryPhoto size={32} />}
          title="No photos yet"
          description="Add a folder to start building your library."
        >
          <EmptyState.Actions>
            <Button onClick={() => void addFolder()}>Add Folder</Button>
          </EmptyState.Actions>
        </EmptyState>
      </Box>
    )
  }

  return (
    <Box p="md" pb="xl" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <Stack gap="xl">
        {sections.map((section) => (
          <DashboardSection
            key={section.id}
            title={section.title}
            icon={section.icon}
            widgets={section.widgets}
            capped={section.capped}
          />
        ))}
      </Stack>
    </Box>
  )
}
