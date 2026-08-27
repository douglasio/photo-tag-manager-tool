import { memo, type ReactElement } from 'react'

import { Badge, Blockquote, Box, Center, Group, Image, Stack, Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { IconAlertTriangle, IconMessage, IconPhoto } from '@tabler/icons-react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { RowComponentProps } from 'react-window'

import { GalleryHoverPreview, TagHoverCard } from '@components'
import { useHoverPreview } from '@hooks'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { useLibraryActions } from '@state'
import { formatDateTaken, isPhotoDisplayable } from '@utils'

import { PhotoContextMenu } from './PhotoContextMenu'

export interface GalleryListRowProps {
  photos: PhotoRecord[]
  selectedPath: string | null
  selectedPaths: Set<string>
  onSelect: (path: string, event: ReactMouseEvent) => void
  previewTriggerHeld: boolean
  previewScale: number
  // Passed as a prop (not read from context) so rows carry no gallery-context
  // subscription — same reasoning as PhotoThumbnail's props.
  animationsEnabled: boolean
}

const THUMB_SIZE = 140
const COMMENT_COLUMN_WIDTH = 260

// Mirrors GalleryPhotoCell's comparator: a selection change or single-photo
// write re-renders only the affected rows, not every visible one.
function rowPropsAreEqual(
  prev: RowComponentProps<GalleryListRowProps>,
  next: RowComponentProps<GalleryListRowProps>
): boolean {
  if (
    prev.index !== next.index ||
    prev.onSelect !== next.onSelect ||
    prev.previewTriggerHeld !== next.previewTriggerHeld ||
    prev.previewScale !== next.previewScale ||
    prev.animationsEnabled !== next.animationsEnabled ||
    prev.style.height !== next.style.height ||
    prev.style.transform !== next.style.transform
  ) {
    return false
  }
  const photo = prev.photos[prev.index]
  if (photo !== next.photos[next.index]) return false
  const filePath = photo?.filePath
  return (
    (filePath === prev.selectedPath) === (filePath === next.selectedPath) &&
    (filePath !== undefined && prev.selectedPaths.has(filePath)) ===
      (filePath !== undefined && next.selectedPaths.has(filePath))
  )
}

/** react-window row renderer for GalleryListView — one photo per row, as a
 * read-only summary (filename, comment, tags, date taken). Editing happens
 * by opening the photo itself, not inline here. */
function GalleryListRowImpl({
  index,
  style,
  photos,
  selectedPath,
  selectedPaths,
  onSelect,
  previewTriggerHeld,
  previewScale,
  animationsEnabled
}: RowComponentProps<GalleryListRowProps>): ReactElement {
  const { openPhotoTab } = useLibraryActions()
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = animationsEnabled && !prefersReducedMotion

  const photo = photos[index]
  const canPreview = Boolean(previewTriggerHeld && photo && photo.thumbnailStatus === 'ready')
  const { position, onMouseMove, onMouseLeave } = useHoverPreview(canPreview)

  if (!photo) return <div style={style} />

  const selected = photo.filePath === selectedPath
  const multiSelected = selectedPaths.has(photo.filePath)

  return (
    <div style={style}>
      <PhotoContextMenu photo={photo}>
        <Box
          p="md"
          bg={
            selected
              ? 'var(--mantine-color-default-hover)'
              : multiSelected
                ? 'var(--mantine-primary-color-light)'
                : undefined
          }
          style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
        >
          <Group wrap="nowrap" gap="lg" align="flex-start">
            <Box
              pos="relative"
              w={THUMB_SIZE}
              style={{ flexShrink: 0 }}
              onClick={(event) => onSelect(photo.filePath, event)}
              onDoubleClick={() => openPhotoTab(photo.filePath)}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
            >
              {isPhotoDisplayable(photo) ? (
                <Image
                  src={toThumbProtocolUrl(photo.thumbnailKey)}
                  alt={photo.fileName}
                  w={THUMB_SIZE}
                  h={THUMB_SIZE}
                  fit="cover"
                  radius="sm"
                  loading="lazy"
                  style={{ cursor: canPreview ? 'zoom-in' : 'pointer' }}
                />
              ) : (
                <Center
                  w={THUMB_SIZE}
                  h={THUMB_SIZE}
                  className="photo-thumbnail__placeholder"
                  c={photo.thumbnailStatus === 'error' ? 'red' : 'dimmed'}
                  style={{ cursor: 'pointer' }}
                >
                  {photo.thumbnailStatus === 'error' ? (
                    <IconAlertTriangle size={32} />
                  ) : (
                    <IconPhoto size={32} />
                  )}
                </Center>
              )}
              <GalleryHoverPreview
                photo={photo}
                position={canPreview ? position : null}
                scale={previewScale}
                motionEnabled={motionEnabled}
              />
            </Box>
            <Stack gap="xs" flex={1} miw={0}>
              <Text fw={700} fz="var(--mantine-h4-font-size)" truncate="end">
                {photo.fileName}
              </Text>
              <Text size="sm" c="dimmed">
                {formatDateTaken(photo.metadata.dateTaken, 'weekday')}
              </Text>
              {photo.tags.length > 0 && (
                <Group gap={4}>
                  {photo.tags.map((tag) => (
                    <TagHoverCard key={tag} tag={tag}>
                      <Badge variant="light" size="lg" tt="none">
                        {tag}
                      </Badge>
                    </TagHoverCard>
                  ))}
                </Group>
              )}
            </Stack>
            {photo.metadata.comment && (
              <Box w={COMMENT_COLUMN_WIDTH} style={{ flexShrink: 0 }}>
                <Blockquote
                  icon={<IconMessage stroke={1} size={18} />}
                  iconSize={26}
                  px="md"
                  py={6}
                >
                  {photo.metadata.comment}
                </Blockquote>
              </Box>
            )}
          </Group>
        </Box>
      </PhotoContextMenu>
    </div>
  )
}

// react-window's rowComponent type expects a plain function component — cast
// back to that shape, same as GalleryPhotoCell.
export const GalleryListRow = memo(GalleryListRowImpl, rowPropsAreEqual) as unknown as (
  props: RowComponentProps<GalleryListRowProps>
) => ReactElement
