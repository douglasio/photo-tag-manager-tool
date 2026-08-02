import { Button, SimpleGrid } from '@mantine/core'
import { IconLibraryPhoto } from '@tabler/icons-react'

import { usePhotoLibrary } from '@state'

export function DashboardView(): React.JSX.Element {
  const { setActiveTab } = usePhotoLibrary()

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} p="md" flex={1}>
      <Button leftSection={<IconLibraryPhoto size={18} />} onClick={() => setActiveTab('gallery')}>
        Go to Gallery
      </Button>
    </SimpleGrid>
  )
}
