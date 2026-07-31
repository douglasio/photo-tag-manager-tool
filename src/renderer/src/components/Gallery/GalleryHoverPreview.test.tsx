import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { PhotoRecord } from '@shared/types'

import { GalleryHoverPreview } from './GalleryHoverPreview'

const photo: PhotoRecord = {
  id: '/a.jpg',
  filePath: '/a.jpg',
  fileName: 'a.jpg',
  tags: [],
  metadata: {
    dateTaken: null,
    cameraMake: null,
    cameraModel: null,
    widthPx: null,
    heightPx: null,
    fileSizeBytes: 0,
    format: 'JPEG',
    comment: null
  },
  thumbnailStatus: 'ready',
  thumbnailKey: 'key123',
  scanError: null,
  fromCache: false
}

describe('GalleryHoverPreview', () => {
  it('renders nothing when position is null', () => {
    render(
      <MantineProvider>
        <GalleryHoverPreview photo={photo} position={null} scale={1} motionEnabled={false} />
      </MantineProvider>
    )
    expect(screen.queryByAltText('a.jpg')).not.toBeInTheDocument()
  })

  it('renders the preview image once a position is given', () => {
    render(
      <MantineProvider>
        <GalleryHoverPreview
          photo={photo}
          position={{ x: 10, y: 20 }}
          scale={1}
          motionEnabled={false}
        />
      </MantineProvider>
    )
    expect(screen.getByAltText('a.jpg')).toBeInTheDocument()
  })
})
