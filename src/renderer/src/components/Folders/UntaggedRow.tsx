import { Badge, Box, Button, Text } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import type { ReactElement } from 'react'

import { usePhotoLibrary } from '@state'
import { activeHoverBackground } from '@utils'

/** Top-level navbar item directly under AllPhotosRow, selecting every
 * untagged photo library-wide — deliberately sits alongside "All Photos"
 * rather than inside the Tags panel, so it reads as a library-wide filter
 * rather than a pseudo-tag buried among the real ones. */
export function UntaggedRow(): ReactElement | null {
  const { untaggedCount, state, setUntaggedFilter } = usePhotoLibrary()
  const { hovered, ref } = useHover<HTMLButtonElement>()

  if (untaggedCount === 0) return null

  return (
    <Box px="md" pb="xs" style={{ flexShrink: 0 }}>
      <Button
        ref={ref}
        onClick={() => setUntaggedFilter(!state.untaggedFilterActive)}
        bg={activeHoverBackground(state.untaggedFilterActive, hovered)}
        variant="transparent"
        justify="space-between"
        fullWidth
        rightSection={
          <Badge size="md" variant={state.untaggedFilterActive ? 'filled' : 'light'}>
            {untaggedCount}
          </Badge>
        }
      >
        <Text>Untagged</Text>
      </Button>
    </Box>
  )
}
