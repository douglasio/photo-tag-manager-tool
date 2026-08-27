import { type Modifier } from '@dnd-kit/core'
import { getEventCoordinates } from '@dnd-kit/utilities'
import { Badge, Box, Center, Image, Paper, Text } from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'

import { RADIUS_SIZE } from '@renderer/theme'
import { ACTION_ICONS, isPhotoDisplayable } from '@renderer/utils'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'

export const DRAG_PREVIEW_SIZE = 64
const DRAG_PREVIEW_OFFSET_X = 0
const DRAG_PREVIEW_OFFSET_Y = 0

// dnd-kit's recipe for centering the overlay under the pointer via its own measured rect.
// eslint-disable-next-line react-refresh/only-export-components -- non-component helper, colocated with the drag-preview components it styles
export const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (draggingNodeRect && activatorEvent) {
    const activatorCoordinates = getEventCoordinates(activatorEvent)
    if (!activatorCoordinates) return transform
    const offsetX = activatorCoordinates.x - draggingNodeRect.left
    const offsetY = activatorCoordinates.y - draggingNodeRect.top
    return {
      ...transform,
      x: transform.x + offsetX - draggingNodeRect.width / 2 + DRAG_PREVIEW_OFFSET_X,
      y: transform.y + offsetY - draggingNodeRect.height / 2 + DRAG_PREVIEW_OFFSET_Y
    }
  }
  return transform
}

// Drag ghost for a gallery thumbnail being dragged onto a tag/folder.
export function DragPreview({
  photo,
  count
}: {
  photo: PhotoRecord
  count: number
}): React.JSX.Element {
  return (
    <Box pos="relative" w={DRAG_PREVIEW_SIZE} h={DRAG_PREVIEW_SIZE}>
      <Box
        w={DRAG_PREVIEW_SIZE}
        h={DRAG_PREVIEW_SIZE}
        opacity={0.75}
        bdrs={RADIUS_SIZE}
        style={{
          overflow: 'hidden',
          boxShadow: 'var(--mantine-shadow-md)',
          cursor: 'grabbing'
        }}
      >
        {isPhotoDisplayable(photo) ? (
          <Image
            src={toThumbProtocolUrl(photo.thumbnailKey)}
            w={DRAG_PREVIEW_SIZE}
            h={DRAG_PREVIEW_SIZE}
            fit="cover"
          />
        ) : (
          <Center w={DRAG_PREVIEW_SIZE} h={DRAG_PREVIEW_SIZE} bg="var(--mantine-color-default)">
            <IconPhoto size={ACTION_ICONS.ICON_SIZE} />
          </Center>
        )}
      </Box>
      {count > 1 && (
        <Badge
          circle
          size="lg"
          variant="filled"
          pos="absolute"
          top={-8}
          right={-8}
          style={{ pointerEvents: 'none' }}
        >
          {count}
        </Badge>
      )}
    </Box>
  )
}

// Drag ghost for a tag being dragged into a group (lighter than DragPreview — no thumbnail).
export function TagDragPreview({ tag }: { tag: string }): React.JSX.Element {
  return (
    <Paper
      withBorder
      shadow="md"
      px="sm"
      py={4}
      radius={RADIUS_SIZE}
      style={{ cursor: 'grabbing' }}
    >
      <Text size="sm" fw={500}>
        #{tag}
      </Text>
    </Paper>
  )
}

// Drag ghost for a face being dragged onto a person (no thumbnail, just a name-less placeholder).
export function FaceDragPreview(): React.JSX.Element {
  return (
    <Paper
      withBorder
      shadow="md"
      px="sm"
      py={4}
      radius={RADIUS_SIZE}
      style={{ cursor: 'grabbing' }}
    >
      <Text size="sm" fw={500}>
        Face
      </Text>
    </Paper>
  )
}

// Drag ghost for a person being dragged onto another one to merge.
export function PersonDragPreview({ name }: { name: string | null }): React.JSX.Element {
  return (
    <Paper
      withBorder
      shadow="md"
      px="sm"
      py={4}
      radius={RADIUS_SIZE}
      style={{ cursor: 'grabbing' }}
    >
      <Text size="sm" fw={500}>
        {name ?? 'Unnamed person'}
      </Text>
    </Paper>
  )
}
