import React from 'react'

import { Button } from '@mantine/core'
import { IconLibraryPhoto } from '@tabler/icons-react'

import { usePhotoLibrary } from '@state'

export function WelcomeWidget(): React.JSX.Element {
  const { setActiveTab } = usePhotoLibrary()

  return (
    <Button leftSection={<IconLibraryPhoto size={18} />} onClick={() => setActiveTab('gallery')}>
      Go to Gallery
    </Button>
  )
}
