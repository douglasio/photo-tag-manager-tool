import { SimpleGrid } from '@mantine/core'

import {
  FeaturedTagWidget,
  QuickTagWidget,
  TaggingProgressWidget,
  TopTagsWidget,
  TopViewedWidget,
  WelcomeWidget
} from '@components'
import DashboardWidget from '@renderer/components/Dashboard/DashboardWidget'
import { Widget } from '@shared/types'

export function DashboardView(): React.JSX.Element {
  const widgets: Widget[] = [
    { id: 'welcome', title: 'Welcome', component: <WelcomeWidget /> },
    { id: 'taggingProgress', title: 'Tagging Progress', component: <TaggingProgressWidget /> },
    { id: 'topTags', title: 'Top Tags', component: <TopTagsWidget /> },
    { id: 'featuredTag', title: 'Featured Tag', component: <FeaturedTagWidget /> },
    { id: 'topViewed', title: 'Top Viewed Photos', component: <TopViewedWidget /> },
    { id: 'quickTag', title: 'Quick Tag', component: <QuickTagWidget /> }
  ]

  return (
    <SimpleGrid
      cols={3}
      spacing="lg"
      p="md"
      autoRows="1fr"
      style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
    >
      {widgets.map((widget) => (
        <DashboardWidget key={widget.id} {...widget} />
      ))}
    </SimpleGrid>
  )
}
