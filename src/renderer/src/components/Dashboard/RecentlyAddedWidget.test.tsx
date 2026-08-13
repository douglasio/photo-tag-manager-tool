import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
const mockOpenPhotoTab = vi.fn()

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: { photosByPath: mockPhotosByPath, galleryAnimationsEnabled: true },
    activePhotosByPath: mockPhotosByPath,
    openPhotoTab: mockOpenPhotoTab
  })
}))

import { RecentlyAddedWidget } from './RecentlyAddedWidget'

function makePhoto(filePath: string, overrides: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: filePath,
    filePath,
    fileName: filePath.split('/').pop() ?? filePath,
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
    thumbnailKey: 'key',
    scanError: null,
    fromCache: false,
    viewCount: 0,
    firstSeenAt: 0,
    ...overrides
  }
}

function setLibrary(photos: PhotoRecord[]): void {
  mockPhotosByPath = new Map(photos.map((photo) => [photo.filePath, photo]))
}

function renderWidget(): void {
  render(
    <MantineProvider>
      <RecentlyAddedWidget />
    </MantineProvider>
  )
}

describe('RecentlyAddedWidget', () => {
  it('shows an empty-state message when there are no photos', () => {
    setLibrary([])
    renderWidget()

    expect(
      screen.getByText('Add some photos to see the most recent ones here.')
    ).toBeInTheDocument()
  })

  it('excludes photos without a ready thumbnail or a known firstSeenAt', () => {
    setLibrary([
      makePhoto('/a.jpg', { firstSeenAt: 100, thumbnailStatus: 'pending', thumbnailKey: null }),
      makePhoto('/b.jpg', { firstSeenAt: undefined })
    ])
    renderWidget()

    expect(
      screen.getByText('Add some photos to see the most recent ones here.')
    ).toBeInTheDocument()
  })

  it('orders photos newest-first by firstSeenAt', () => {
    setLibrary([
      makePhoto('/old.jpg', { firstSeenAt: 100 }),
      makePhoto('/new.jpg', { firstSeenAt: 300 }),
      makePhoto('/mid.jpg', { firstSeenAt: 200 })
    ])
    renderWidget()

    const images = screen.getAllByRole('img')
    expect(images.map((img) => img.getAttribute('alt'))).toEqual(['new.jpg', 'mid.jpg', 'old.jpg'])
  })

  it('caps the grid at the 4 most recently added photos', () => {
    setLibrary(Array.from({ length: 8 }, (_, i) => makePhoto(`/p${i}.jpg`, { firstSeenAt: i + 1 })))
    renderWidget()

    expect(screen.getAllByRole('img')).toHaveLength(4)
  })

  it('opens the photo tab when a tile is clicked', async () => {
    const user = userEvent.setup()
    setLibrary([makePhoto('/a.jpg', { firstSeenAt: 100 })])
    renderWidget()

    await user.click(screen.getByRole('img'))

    expect(mockOpenPhotoTab).toHaveBeenCalledExactlyOnceWith('/a.jpg')
  })
})
