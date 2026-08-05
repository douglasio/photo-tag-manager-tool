import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
let mockAllTags: string[]
let mockRecentTags: string[]
const mockUpdateTags = vi.fn()

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: {
      photosByPath: mockPhotosByPath,
      galleryAnimationsEnabled: false,
      recentTags: mockRecentTags
    },
    allTags: mockAllTags,
    updateTags: mockUpdateTags
  })
}))

// The real TagList renders a full TagsInput combobox, which isn't needed to
// exercise QuickTagWidget's own photo-picking/skip logic — a bare button
// standing in for "add a tag" keeps these tests focused on that.
vi.mock('@components', () => ({
  TagList: ({ onChange }: { onChange: (tags: string[]) => void }) => (
    <button onClick={() => onChange(['vacation'])}>mock-add-tag</button>
  ),
  // The real GalleryHoverPreview isn't relevant to this widget's own
  // picking/skip logic — a no-op stub keeps these tests from needing to
  // stand up the Portal/motion machinery it renders.
  GalleryHoverPreview: () => null,
  PhotoGradientOverlay: () => null
}))

import { QuickTagWidget } from './QuickTagWidget'

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
  mockAllTags = []
  mockRecentTags = []
}

function renderWidget(): ReturnType<typeof render> {
  return render(
    <MantineProvider>
      <QuickTagWidget />
    </MantineProvider>
  )
}

describe('QuickTagWidget', () => {
  it('shows a congratulatory empty state when every photo is already tagged', () => {
    setLibrary([makePhoto('/a.jpg', { tags: ['vacation'] })])
    renderWidget()

    expect(screen.getByText('Every photo is tagged — nice work!')).toBeInTheDocument()
  })

  it('surfaces an untagged, thumbnail-ready photo with a Skip button', () => {
    setLibrary([makePhoto('/a.jpg', { tags: [] })])
    renderWidget()

    expect(screen.getByRole('img')).toHaveAttribute('src', 'photag-thumb://key')
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  })

  it('excludes already-tagged and not-yet-thumbnailed photos from candidacy', () => {
    setLibrary([
      makePhoto('/tagged.jpg', { tags: ['vacation'] }),
      makePhoto('/pending.jpg', { tags: [], thumbnailStatus: 'pending', thumbnailKey: null })
    ])
    renderWidget()

    expect(screen.getByText('Every photo is tagged — nice work!')).toBeInTheDocument()
  })

  it('falls back to the empty state after skipping the only untagged photo', async () => {
    const user = userEvent.setup()
    setLibrary([makePhoto('/a.jpg', { tags: [] })])
    renderWidget()

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(screen.getByText('Every photo is tagged — nice work!')).toBeInTheDocument()
  })

  it('swaps Skip for "Tag another" once the current photo picks up a tag', () => {
    setLibrary([makePhoto('/a.jpg', { tags: [] })])
    const { rerender } = renderWidget()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()

    // Mimics a tag landing on the current photo via the live photosByPath map
    // (e.g. applied through the mocked TagList) rather than re-picking it.
    mockPhotosByPath.set('/a.jpg', makePhoto('/a.jpg', { tags: ['vacation'] }))
    rerender(
      <MantineProvider>
        <QuickTagWidget />
      </MantineProvider>
    )

    expect(screen.getByRole('button', { name: /Tag another/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  })
})
