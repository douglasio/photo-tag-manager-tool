import { Center, Image } from '@mantine/core'
import type { ReactElement } from 'react'
import type { PhotoRecord } from '../../../shared/types'
import { toFileProtocolUrl } from '../../../shared/protocolUrls'

interface PhotoViewProps {
  photo: PhotoRecord
}

export function PhotoView({ photo }: PhotoViewProps): ReactElement {
  return (
    <Center h="100%" w="100%" style={{ overflow: 'hidden' }}>
      <Image
        src={toFileProtocolUrl(photo.filePath)}
        alt={photo.fileName}
        fit="contain"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      />
    </Center>
  )
}
