import { Badge, Blockquote, Box, Center, Group, Image, Stack, Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { IconAlertTriangle, IconMessage, IconPhoto } from '@tabler/icons-react'
import type { ReactElement } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { RowComponentProps } from 'react-window'

import { GalleryHoverPreview } from '@components'
import { useHoverPreview } from '@hooks'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { formatDateTaken } from '@utils'

import { PhotoContextMenu } from './PhotoContextMenu'

export interface GalleryListRowProps {
  photos: PhotoRecord[]
  selectedPath: string | null
  selectedPaths: Set<string>
  onSelect: (path: string, event: ReactMouseEvent) => void
  previewTriggerHeld: boolean
  previewScale: number
}

const THUMB_SIZE = 140
const COMMENT_COLUMN_WIDTH = 260

/** react-window row renderer for GalleryListView — one photo per row, as a
 * read-only summary (filename, comment, tags, date taken). Editing happens
 * by opening the photo itself, not inline here. */
export function GalleryListRow({
  index,
  style,
  photos,
  selectedPath,
  selectedPaths,
  onSelect,
  previewTriggerHeld,
  previewScale
}: RowComponentProps<GalleryListRowProps>): ReactElement {
  const { state, openPhotoTab } = usePhotoLibrary()
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion

  const photo = photos[index]
  const canPreview = Boolean(previewTriggerHeld && photo && photo.thumbnailStatus === 'ready')
  const { position, onMouseMove, onMouseLeave } = useHoverPreview(canPreview)

  if (!photo) return <div style={style} />

  const selected = photo.filePath === selectedPath
  const multiSelected = selectedPaths.has(photo.filePath)

  return (
    <div style={style}>
      <PhotoContextMenu photo={photo} onRename={() => openPhotoTab(photo.filePath)}>
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
              {photo.thumbnailStatus === 'ready' && photo.thumbnailKey ? (
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
                    <Badge key={tag} variant="light" size="lg" tt="none">
                      {tag}
                    </Badge>
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
