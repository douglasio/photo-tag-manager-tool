import { memo, type ReactElement } from 'react'

import { Box, Button, Divider, EmptyState, Group, SimpleGrid, Stack, Title } from '@mantine/core'
import { IconHistory, IconHome2, IconLibraryPhoto, IconTags, IconUsers } from '@tabler/icons-react'

import {
  FeaturedPersonWidget,
  FeaturedTagWidget,
  NameThisPersonWidget,
  PhotosFromYearWidget,
  RecentlyAddedWidget,
  ScanProgressIndicator,
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

// Memoized: takes no props, so it bails out when AppLayout re-renders
// (e.g. a drag starting/ending flips its activeDrag state) and only
// re-renders when its own context subscriptions actually change.
export const DashboardView = memo(function DashboardView(): React.JSX.Element {
  const { activePhotosByPath, addFolder, state } = usePhotoLibrary()

  const sections: DashboardSectionData[] = [
    {
      id: 'home',
      title: 'Home',
      icon: IconHome2,
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
      widgets: [
        { id: 'taggingProgress', title: 'Tagging Progress', component: <TaggingProgressWidget /> },
        {
          id: 'tagThisPhoto',
          title: 'Tag This Photo',
          component: <TagThisPhotoWidget />,
          colSpan: 1
        },
        { id: 'featuredTag', title: 'Featured Tag', component: <FeaturedTagWidget /> },
        { id: 'topTags', title: 'Top Tags', component: <TopTagsWidget /> }
      ]
    },
    {
      id: 'people',
      title: 'People',
      icon: IconUsers,
      widgets: [
        { id: 'featuredPerson', title: 'Featured Person', component: <FeaturedPersonWidget /> },
        // Card only exists when there's actually someone to name — an empty
        // one would just be dead space, unlike the onboarding-timeline
        // widgets, which always have something to show.
        ...(state.people.some((person) => person.name === null)
          ? [
              {
                id: 'nameThisPerson',
                title: 'Name This Person',
                component: <NameThisPersonWidget />
              }
            ]
          : [])
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
    if (state.status === 'scanning') {
      return (
        <Box
          flex="1"
          mih={0}
          display="flex"
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          <ScanProgressIndicator percent={null} label="Scanning for photos…" />
        </Box>
      )
    }
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
          />
        ))}
      </Stack>
    </Box>
  )
})
