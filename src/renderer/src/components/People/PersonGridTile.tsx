import { AspectRatio, Box, Stack, Text, UnstyledButton } from '@mantine/core'
import type { ReactElement } from 'react'

import { FaceCropThumbnail, PhotoGradientOverlay } from '@components'
import { RADIUS_SIZE } from '@renderer/theme'
import type { FaceBox } from '@shared/types'
import { PREVIEW_TRIGGER_KEY } from '@utils'

interface PersonGridTileProps {
  name: string
  faceCount: number
  coverThumbnailKey: string | null | undefined
  coverFaceBox: FaceBox | null
  isActive: boolean
  onSelect: () => void
}

// Grid-view alternative to PersonRow — mirrors TagGridTile exactly,
// including its reduced feature set: view + select only, no rename/hide/
// delete/drag/drop here (those stay list-view-only, same as tags — no
// natural home for that on a bare tile). Right-click has no menu in grid
// view either, matching tags.
export function PersonGridTile({
  name,
  faceCount,
  coverThumbnailKey,
  coverFaceBox,
  isActive,
  onSelect
}: PersonGridTileProps): ReactElement {
  const hasThumbnail = Boolean(coverThumbnailKey && coverFaceBox)

  const label = (
    <Stack gap={0} pos="absolute" bottom={0} left={0} right={0} p="xs" style={{ zIndex: 2 }}>
      <Text c={hasThumbnail ? 'white' : undefined} fw={700} truncate="end">
        {name}
      </Text>
      <Text c={hasThumbnail ? 'white' : 'dimmed'} size="xs">
        {faceCount} face{faceCount === 1 ? '' : 's'}
      </Text>
    </Stack>
  )

  return (
    <UnstyledButton
      onClick={onSelect}
      // Space is the gallery's preview-trigger key, not a click here — see
      // TagListItem's identical guard for why.
      onKeyDown={(event) => {
        if (event.key === PREVIEW_TRIGGER_KEY) event.preventDefault()
      }}
      w="100%"
      bdrs={RADIUS_SIZE}
      pos="relative"
      style={{
        overflow: 'hidden',
        outline: isActive ? '2px solid var(--mantine-primary-color-filled)' : undefined,
        outlineOffset: -2
      }}
    >
      <AspectRatio ratio={1}>
        {hasThumbnail ? (
          <Box className="dashboard-photo-frame">
            <FaceCropThumbnail thumbnailKey={coverThumbnailKey!} box={coverFaceBox!} />
            <PhotoGradientOverlay />
          </Box>
        ) : (
          <Box bg="var(--mantine-primary-color-light)" />
        )}
      </AspectRatio>
      {label}
    </UnstyledButton>
  )
}
