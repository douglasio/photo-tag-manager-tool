import { Button, Text } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { activeHoverBackground } from '../utils/listItemStyles'
import { FolderBadge } from './FolderBadge'

/** Top-level navbar item above Tags/Folders, selecting the unfiltered library view. */
export function AllPhotosRow(): ReactElement {
  const { state, setFolderFilter } = usePhotoLibrary()
  const { hovered, ref } = useHover<HTMLButtonElement>()
  const isActive = state.selectedFolder === null && state.selectedTag === null

  return (
    <Button
      ref={ref}
      onClick={() => setFolderFilter(null)}
      bg={activeHoverBackground(isActive, hovered)}
      variant="transparent"
      justify="space-between"
      fullWidth
      rightSection={<FolderBadge isActive={isActive}>{state.photosByPath.size}</FolderBadge>}
    >
      <Text>All Photos</Text>
    </Button>
  )
}
