import { MantineProvider } from '@mantine/core'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

const mockIncrementViewCount = vi.fn()
vi.mock('@state', () => ({
  usePreviewTriggerHeld: () => false,
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
  beforeEach(() => {
    vi.useFakeTimers()
    mockIncrementViewCount.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when position is null', () => {
    render(
      <MantineProvider>
        <GalleryHoverPreview photo={photo} position={null} scale={1} motionEnabled={false} />
      </MantineProvider>
    )
    expect(screen.queryByAltText('a.jpg')).not.toBeInTheDocument()
    expect(mockIncrementViewCount).not.toHaveBeenCalled()
  })

  it('renders the preview image once a position is given, without counting a view yet', () => {
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
    expect(mockIncrementViewCount).not.toHaveBeenCalled()
  })

  it('counts a view only after the preview closes and the delay elapses', () => {
    const { rerender } = render(
      <MantineProvider>
        <GalleryHoverPreview
          photo={photo}
          position={{ x: 10, y: 20 }}
          scale={1}
          motionEnabled={false}
        />
      </MantineProvider>
    )

    rerender(
      <MantineProvider>
        <GalleryHoverPreview photo={photo} position={null} scale={1} motionEnabled={false} />
      </MantineProvider>
    )
    expect(mockIncrementViewCount).not.toHaveBeenCalled()

    act(() => vi.runAllTimers())
    expect(mockIncrementViewCount).toHaveBeenCalledExactlyOnceWith('/a.jpg')
  })

  it('does not count a view if reopened before the delay elapses', () => {
    const { rerender } = render(
      <MantineProvider>
        <GalleryHoverPreview
          photo={photo}
          position={{ x: 10, y: 20 }}
          scale={1}
          motionEnabled={false}
        />
      </MantineProvider>
    )

    rerender(
      <MantineProvider>
        <GalleryHoverPreview photo={photo} position={null} scale={1} motionEnabled={false} />
      </MantineProvider>
    )
    rerender(
      <MantineProvider>
        <GalleryHoverPreview
          photo={photo}
          position={{ x: 15, y: 25 }}
          scale={1}
          motionEnabled={false}
        />
      </MantineProvider>
    )

    act(() => vi.runAllTimers())
    expect(mockIncrementViewCount).not.toHaveBeenCalled()
  })
})
