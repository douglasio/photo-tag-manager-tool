import { SimpleGrid } from '@mantine/core'

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

export function DashboardView(): React.JSX.Element {
  const widgets: Widget[] = [
    { id: 'welcome', title: 'Welcome', component: <WelcomeWidget /> },
    { id: 'featuredTag', title: 'Featured Tag', component: <FeaturedTagWidget /> },
    { id: 'topViewed', title: 'Top Viewed Photos', component: <TopViewedWidget /> },
    {
      id: 'taggingProgress',
      title: 'Tagging Progress',
      component: <TaggingProgressWidget />,
      colSpan: 2
    },
    { id: 'topTags', title: 'Top Tags', component: <TopTagsWidget /> },
    { id: 'throwback', title: 'Throwback', component: <ThrowbackWidget />, colSpan: 2 }
  ]

  return (
    <SimpleGrid
      cols={3}
      spacing="lg"
      p="md"
      pb="lg"
      // minmax (not a flat 1fr) — rows still match each other by default, but
      // can grow past that floor for taller content (e.g. Throwback's
      // Timeline), with the grid itself scrolling instead of clipping.
      autoRows="minmax(340px, auto)"
      style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
    >
      {widgets.map((widget) => (
        <DashboardWidget key={widget.id} {...widget} />
      ))}
    </SimpleGrid>
  )
}
