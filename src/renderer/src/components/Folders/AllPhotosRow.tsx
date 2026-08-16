import { Box, Button, Text } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import type { ReactElement } from 'react'

import { useGalleryLibrary, useLibraryActions, useSidebarLibrary } from '@state'
import { activeHoverBackground } from '@utils'

import { FolderBadge } from './FolderBadge'

/** Top-level navbar item above Tags/Folders, selecting the unfiltered library view. */
export function AllPhotosRow(): ReactElement {
  const { state: sidebarState } = useSidebarLibrary()
  const { state: galleryState } = useGalleryLibrary()
  const { setFolderFilter } = useLibraryActions()
  const { hovered, ref } = useHover<HTMLButtonElement>()
  const isActive =
    sidebarState.selectedFolder === null &&
    sidebarState.selectedTag === null &&
    !sidebarState.untaggedFilterActive

  return (
    <Box px="md" py="xs" style={{ flexShrink: 0 }}>
      <Button
        ref={ref}
        onClick={() => setFolderFilter(null)}
        bg={activeHoverBackground(isActive, hovered)}
        variant="transparent"
        justify="space-between"
        fullWidth
        rightSection={
          <FolderBadge isActive={isActive}>{galleryState.photosByPath.size}</FolderBadge>
        }
      >
        <Text>All Photos</Text>
      </Button>
    </Box>
  )
}
