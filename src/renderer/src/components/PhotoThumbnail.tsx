import { Box, Center, Image, UnstyledButton, useMantineTheme } from '@mantine/core'
import { IconAlertTriangle, IconPhoto } from '@tabler/icons-react'
import type { ComponentPropsWithoutRef, ReactElement } from 'react'
import type { PhotoRecord } from '../../../shared/types'
import { toThumbProtocolUrl } from '../../../shared/protocolUrls'
import { GalleryFileName } from './GalleryFileName'

interface PhotoThumbnailProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onSelect'> {
  photo: PhotoRecord
  selected: boolean
  onSelect: (path: string) => void
  renaming: boolean
  onStartRename: () => void
  onStopRename: () => void
  onRename: (newBaseName: string) => Promise<void>
}

// The root can't be a single button anymore — GalleryFileName's inline editor
// (via InlineEditField) renders its own nested pencil ActionIcon button, and a
// button can't be nested inside another button. So the image gets its own
// inner button for click-to-select, while the filename is a sibling. `...rest`
// (needed for PhotoContextMenu's onContextMenu/onMouseDown injection) moves to
// this outer, non-button container since right-click should work anywhere on
// the thumbnail.
export function PhotoThumbnail({
  photo,
  selected,
  onSelect,
  renaming,
  onStartRename,
  onStopRename,
  onRename,
  className,
  ...rest
}: PhotoThumbnailProps): ReactElement {
  const theme = useMantineTheme()

  return (
    <Box
      {...rest}
      title={photo.fileName}
      className={`photo-thumbnail${selected ? ' photo-thumbnail--selected' : ''}${className ? ` ${className}` : ''}`}
    >
      <UnstyledButton onClick={() => onSelect(photo.filePath)} w="100%">
        {photo.thumbnailStatus === 'ready' && photo.thumbnailKey ? (
          <Image
            src={toThumbProtocolUrl(photo.thumbnailKey)}
            alt={photo.fileName}
            fit="cover"
            loading="lazy"
            style={{ aspectRatio: 1, width: '100%' }}
          />
        ) : (
          <Center
            className="photo-thumbnail__placeholder"
            c={photo.thumbnailStatus === 'error' ? 'red' : 'dimmed'}
          >
            {photo.thumbnailStatus === 'error' ? (
              <IconAlertTriangle size={theme.spacing.xl} />
            ) : (
              <IconPhoto size={theme.spacing.xl} />
            )}
          </Center>
        )}
      </UnstyledButton>
      <Box w="100%">
        <GalleryFileName
          fileName={photo.fileName}
          editing={renaming}
          onStartEdit={onStartRename}
          onStopEdit={onStopRename}
          onRename={onRename}
        />
      </Box>
    </Box>
  )
}
