import { Center, Stack } from '@mantine/core'
import type { ReactElement } from 'react'

import { usePhotoLibrary } from '@state'

import { ScanProgressIndicator } from './ScanProgressIndicator'

// Shown briefly while folders load, then while the startup scan streams photos in.
export function StartupLoadingScreen(): ReactElement {
  const { state } = usePhotoLibrary()
  const processed = state.photosByPath.size
  const total = state.filesFound

  return (
    <Center h="100vh">
      <Stack align="center" gap="xl" w={320}>
        <ScanProgressIndicator
          percent={total > 0 ? Math.round((processed / total) * 100) : null}
          label={total > 0 ? `Loading ${processed} / ${total} photos` : undefined}
        />
      </Stack>
    </Center>
  )
}
