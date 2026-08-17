import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
const mockSetUntaggedFilter = vi.fn()
const mockSetActiveTab = vi.fn()

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    activePhotosByPath: mockPhotosByPath,
    untaggedCount: Array.from(mockPhotosByPath.values()).filter((photo) => photo.tags.length === 0)
      .length,
    setUntaggedFilter: mockSetUntaggedFilter,
    setActiveTab: mockSetActiveTab
  })
}))

import { TaggingProgressWidget } from './TaggingProgressWidget'

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
    ...overrides
  }
}

function setLibrary(photos: PhotoRecord[]): void {
  mockPhotosByPath = new Map(photos.map((photo) => [photo.filePath, photo]))
}

function renderWidget(): void {
  render(
    <MantineProvider>
      <TaggingProgressWidget />
    </MantineProvider>
  )
}

describe('TaggingProgressWidget', () => {
  it('shows an empty-state message when the library has no photos', () => {
    setLibrary([])
    renderWidget()

    expect(screen.getByText('Add some photos to see your tagging progress.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('shows the tagged/untagged split as a progress bar', () => {
    setLibrary([
      makePhoto('/a.jpg', { tags: ['vacation'] }),
      makePhoto('/b.jpg', { tags: [] }),
      makePhoto('/c.jpg', { tags: [] })
    ])
    renderWidget()

    expect(screen.getByText('1 of 3 tagged')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', String((1 / 3) * 100))
  })

  it('hides the "view untagged" link once everything is tagged', () => {
    setLibrary([makePhoto('/a.jpg', { tags: ['vacation'] })])
    renderWidget()

    expect(screen.queryByText('View untagged photos')).not.toBeInTheDocument()
  })

  it('filters to untagged photos and switches to the gallery tab when clicked', async () => {
    const user = userEvent.setup()
    setLibrary([makePhoto('/a.jpg', { tags: [] })])
    renderWidget()

    await user.click(screen.getByText('View untagged photos'))

    expect(mockSetUntaggedFilter).toHaveBeenCalledWith(true)
    expect(mockSetActiveTab).toHaveBeenCalledWith('gallery')
  })
})
