import { Center, Image, Text, UnstyledButton } from '@mantine/core'
import type { ReactElement } from 'react'
import type { PhotoRecord } from '../../../shared/types'
import { toThumbProtocolUrl } from '../../../shared/protocolUrls'

interface PhotoThumbnailProps {
  photo: PhotoRecord
  selected: boolean
  onSelect: (path: string) => void
}

export function PhotoThumbnail({ photo, selected, onSelect }: PhotoThumbnailProps): ReactElement {
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
        <Center className="photo-thumbnail__placeholder">
          <Text c={photo.thumbnailStatus === 'error' ? 'red' : 'dimmed'}>
            {photo.thumbnailStatus === 'error' ? '⚠︎' : '…'}
          </Text>
        </Center>
      )}
      <Text c="dimmed" truncate="end" ta="center" w="100%">
        {photo.fileName}
      </Text>
    </UnstyledButton>
  )
}
