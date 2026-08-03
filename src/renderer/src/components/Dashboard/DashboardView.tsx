import { Button, Grid, Stack, Title } from '@mantine/core'
import { IconLibraryPhoto } from '@tabler/icons-react'

import { FeaturedTagWidget, TopViewedWidget } from '@components'
import { usePhotoLibrary } from '@state'

export function DashboardView(): React.JSX.Element {
  const { setActiveTab } = usePhotoLibrary()

  const gridColProps = { span: 4 }

  return (
    <Grid gap="lg" p="md">
      <Grid.Col {...gridColProps}>
        <Stack gap="md" align="flex-start">
          <Title>Welcome to Tag Me</Title>
          <Button
            leftSection={<IconLibraryPhoto size={18} />}
            onClick={() => setActiveTab('gallery')}
          >
            Go to Gallery
          </Button>
        </Stack>
      </Grid.Col>
      <Grid.Col {...gridColProps}>
        <FeaturedTagWidget />
      </Grid.Col>
      <Grid.Col {...gridColProps}>
        <TopViewedWidget />
      </Grid.Col>
      <Grid.Col {...gridColProps}></Grid.Col>
      <Grid.Col {...gridColProps}></Grid.Col>
      <Grid.Col {...gridColProps}></Grid.Col>
    </Grid>
  )
}
