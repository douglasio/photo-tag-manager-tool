import { Center, Loader } from '@mantine/core'
import type { ReactElement } from 'react'

// Shown while a cover theme's lazy-loaded font is still fetching, instead of
// flashing the fallback system font in before it pops in.
export function CoverLoadingPlaceholder(): ReactElement {
  return (
    <Center h="100%" w="100%">
      <Loader />
    </Center>
  )
}
