import { Center, Image, UnstyledButton, Text, useMantineTheme } from '@mantine/core'
import { IconAlertTriangle, IconPhoto } from '@tabler/icons-react'
import type { ReactElement } from 'react'
import type { PhotoRecord } from '../../../shared/types'
import { toThumbProtocolUrl } from '../../../shared/protocolUrls'

interface PhotoThumbnailProps {
  photo: PhotoRecord
  selected: boolean
  onSelect: (path: string) => void
}

export function PhotoThumbnail({ photo, selected, onSelect }: PhotoThumbnailProps): ReactElement {
  const theme = useMantineTheme()

  return (
    <UnstyledButton
      onClick={() => onSelect(photo.filePath)}
      title={photo.fileName}
      className={`photo-thumbnail${selected ? ' photo-thumbnail--selected' : ''}`}
    >
      {photo.thumbnailStatus === 'ready' && photo.thumbnailKey ? (
        <Image
          src={toThumbProtocolUrl(photo.thumbnailKey)}
          alt={photo.fileName}
          radius="sm"
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
      <Text c="dimmed" truncate="end" ta="center" w="100%">
        {photo.fileName}
      </Text>
    </UnstyledButton>
  )
}
