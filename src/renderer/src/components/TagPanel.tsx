import { AspectRatio, Badge, Button, Image, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useHover } from '@mantine/hooks'
import { useState, type ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { activeHoverBackground } from '../utils/listItemStyles'
import { getDraggedPhotoPaths, hasDraggedPhotoPaths } from '../utils/photoDrag'
import { toThumbProtocolUrl } from '../../../shared/protocolUrls'
import type { PhotoRecord } from '../../../shared/types'

const COVER_SIZE = 28

interface TagListItemProps {
  tag: string
  count: number
  description: string
  coverPhoto: PhotoRecord | undefined
  isActive: boolean
  onSelect: () => void
  onDropPhotos: (tag: string, filePaths: string[]) => void
}

function TagListItem({
  tag,
  count,
  description,
  coverPhoto,
  isActive,
  onSelect,
  onDropPhotos
}: TagListItemProps): ReactElement {
  const { hovered, ref } = useHover<HTMLButtonElement>()
  const [dragOver, setDragOver] = useState(false)

  return (
    <Button
      ref={ref}
      onClick={onSelect}
      fullWidth
      justify="space-between"
      variant="transparent"
      bg={
        dragOver ? 'var(--mantine-primary-color-light)' : activeHoverBackground(isActive, hovered)
      }
      style={{
        outline: dragOver ? '2px dashed var(--mantine-primary-color-filled)' : undefined,
        outlineOffset: -2
      }}
      onDragOver={(event) => {
        if (!hasDraggedPhotoPaths(event.dataTransfer)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        if (!hasDraggedPhotoPaths(event.dataTransfer)) return
        event.preventDefault()
        setDragOver(false)
        const filePaths = getDraggedPhotoPaths(event.dataTransfer)
        if (filePaths.length > 0) onDropPhotos(tag, filePaths)
      }}
      styles={{
        label: {
          flex: 1,
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center'
        }
      }}
      leftSection={
        coverPhoto?.thumbnailStatus === 'ready' &&
        coverPhoto.thumbnailKey && (
          <AspectRatio ratio={1 / 1}>
            <Image
              src={toThumbProtocolUrl(coverPhoto.thumbnailKey)}
              w={COVER_SIZE}
              h={COVER_SIZE}
              fit="cover"
            />
          </AspectRatio>
        )
      }
      rightSection={
        <Badge circle variant={isActive ? 'filled' : 'light'} style={{ flexShrink: 0 }}>
          {count}
        </Badge>
      }
    >
      <Text display="block" lh="1" ta="left" truncate="end">
        {tag}
      </Text>
      {description && (
        <Text display="block" truncate="end" size="xs" c="dimmed" lineClamp={1}>
          {description}
        </Text>
      )}
    </Button>
  )
}

export function TagPanel(): ReactElement {
  const { allTags, tagCounts, tagCoverPhotos, state, setTagFilter, addTagsToPhotos } =
    usePhotoLibrary()

  const handleDropPhotos = (tag: string, filePaths: string[]): void => {
    void addTagsToPhotos([tag], filePaths).then(() => {
      notifications.show({
        color: 'teal',
        message: `Added #${tag} to ${filePaths.length} photo${filePaths.length === 1 ? '' : 's'}`
      })
    })
  }

  if (allTags.length === 0) {
    return <Text c="dimmed">No tags yet.</Text>
  }

  return (
    <Stack gap="xs">
      {allTags.map((tag) => {
        const isActive = state.selectedTag === tag
        return (
          <TagListItem
            key={tag}
            tag={tag}
            count={tagCounts.get(tag) ?? 0}
            description={state.tagDescriptions.get(tag) ?? ''}
            coverPhoto={tagCoverPhotos.get(tag)}
            isActive={isActive}
            onSelect={() => setTagFilter(isActive ? null : tag)}
            onDropPhotos={handleDropPhotos}
          />
        )
      })}
    </Stack>
  )
}
