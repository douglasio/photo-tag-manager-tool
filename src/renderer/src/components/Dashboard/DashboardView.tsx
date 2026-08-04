import { Grid } from '@mantine/core'

import { FeaturedTagWidget, QuickTagWidget, TopViewedWidget, WelcomeWidget } from '@components'
import DashboardWidget from '@renderer/components/Dashboard/DashboardWidget'
import { Widget } from '@shared/types'

export function DashboardView(): React.JSX.Element {
  const gridColProps = { span: 4 }

  const widgets: Widget[] = [
    { id: 'welcome', title: 'Welcome', component: <WelcomeWidget /> },
    { id: 'featuredTag', title: 'Featured Tag', component: <FeaturedTagWidget /> },
    { id: 'topViewed', title: 'Top Viewed Photos', component: <TopViewedWidget /> },
    { id: 'quickTag', title: 'Quick Tag', component: <QuickTagWidget /> }
  ]

  return (
    <Grid gap="lg" p="md" align="stretch">
      {widgets.map((widget) => (
        <Grid.Col key={widget.id} {...gridColProps}>
          <DashboardWidget {...widget} />
        </Grid.Col>
      ))}
    </Grid>
  )
}
