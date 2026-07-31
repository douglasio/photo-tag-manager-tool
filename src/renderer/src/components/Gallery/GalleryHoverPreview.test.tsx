import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

const mockIncrementViewCount = vi.fn()
vi.mock('@state', () => ({
  usePhotoLibrary: () => ({ incrementViewCount: mockIncrementViewCount })
}))

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
  fromCache: false,
  viewCount: 0
}

describe('GalleryHoverPreview', () => {
  it('renders nothing when position is null', () => {
    render(
      <MantineProvider>
        <GalleryHoverPreview photo={photo} position={null} scale={1} motionEnabled={false} />
      </MantineProvider>
    )
    expect(screen.queryByAltText('a.jpg')).not.toBeInTheDocument()
    expect(mockIncrementViewCount).not.toHaveBeenCalled()
  })

  it('renders the preview image once a position is given, and counts it as a view', () => {
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
    expect(mockIncrementViewCount).toHaveBeenCalledExactlyOnceWith('/a.jpg')
  })
})
