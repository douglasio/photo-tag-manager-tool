import { Center, Stack } from '@mantine/core'
import type { ReactElement } from 'react'

import { useScanProgress } from '@state'

import { ScanProgressIndicator } from './ScanProgressIndicator'

// Shown briefly while folders load, then while the startup scan streams photos in.
export function StartupLoadingScreen(): ReactElement {
  const { photoScanProgress } = useScanProgress()
  const done = photoScanProgress?.done ?? 0
  const total = photoScanProgress?.total ?? 0

  return (
    <Center h="100vh">
      <Stack align="center" gap="xl" w={320}>
        <ScanProgressIndicator
          percent={total > 0 ? Math.round((done / total) * 100) : null}
          label={total > 0 ? `Loading ${done} / ${total} photos` : undefined}
        />
      </Stack>
    </Center>
  )
}
