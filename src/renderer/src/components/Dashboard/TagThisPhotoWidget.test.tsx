import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
let mockAllTags: string[]
let mockRecentTags: string[]
let mockAiTagSuggestionsEnabled: boolean
const mockUpdateTags = vi.fn()
const mockSuggestTags = vi.fn()

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: {
      photosByPath: mockPhotosByPath,
      galleryAnimationsEnabled: false,
      recentTags: mockRecentTags,
      aiTagSuggestionsEnabled: mockAiTagSuggestionsEnabled
    },
    activePhotosByPath: mockPhotosByPath,
    allTags: mockAllTags,
    updateTags: mockUpdateTags,
    suggestTags: mockSuggestTags
  })
}))

// The real TagList renders a full TagsInput combobox, which isn't needed to
// exercise TagThisPhotoWidget's own photo-picking/skip logic — a bare button
// standing in for "add a tag" keeps these tests focused on that.
vi.mock('@components', () => ({
  TagList: ({ onChange }: { onChange: (tags: string[]) => void }) => (
    <button onClick={() => onChange(['vacation'])}>mock-add-tag</button>
  ),
  // The real GalleryHoverPreview isn't relevant to this widget's own
  // picking/skip logic — a no-op stub keeps these tests from needing to
  // stand up the Portal/motion machinery it renders.
  GalleryHoverPreview: () => null,
  PhotoGradientOverlay: () => null,
  SuggestedTagsRow: ({
    suggestions,
    onAccept
  }: {
    suggestions: { tag: string }[]
    onAccept: (tag: string) => void
  }) => (
    <div>
      {suggestions.map((s) => (
        <button key={s.tag} onClick={() => onAccept(s.tag)}>
          + {s.tag}
        </button>
      ))}
    </div>
  )
}))

import { TagThisPhotoWidget } from './TagThisPhotoWidget'

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
  mockAiTagSuggestionsEnabled = false
  mockSuggestTags.mockReset().mockResolvedValue([])
}

function renderWidget(): ReturnType<typeof render> {
  return render(
    <MantineProvider>
      <TagThisPhotoWidget />
    </MantineProvider>
  )
}

describe('TagThisPhotoWidget', () => {
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
        <TagThisPhotoWidget />
      </MantineProvider>
    )

    expect(screen.getByRole('button', { name: /Tag another/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  })

  it('does not request suggestions when AI tag suggestions are disabled', () => {
    setLibrary([makePhoto('/a.jpg', { tags: [] })])
    mockAllTags = ['vacation']
    renderWidget()

    expect(mockSuggestTags).not.toHaveBeenCalled()
  })

  it('requests and renders suggestions for the current photo when enabled', async () => {
    setLibrary([makePhoto('/a.jpg', { tags: [] })])
    mockAllTags = ['vacation']
    mockAiTagSuggestionsEnabled = true
    mockSuggestTags.mockResolvedValue([{ tag: 'vacation', score: 0.9 }])
    renderWidget()

    expect(mockSuggestTags).toHaveBeenCalledExactlyOnceWith('/a.jpg', ['vacation'])
    expect(await screen.findByRole('button', { name: '+ vacation' })).toBeInTheDocument()
  })

  it('adds a suggested tag to the current photo when accepted', async () => {
    setLibrary([makePhoto('/a.jpg', { tags: [] })])
    mockAllTags = ['vacation']
    mockAiTagSuggestionsEnabled = true
    mockSuggestTags.mockResolvedValue([{ tag: 'vacation', score: 0.9 }])
    const user = userEvent.setup()
    renderWidget()

    await user.click(await screen.findByRole('button', { name: '+ vacation' }))

    expect(mockUpdateTags).toHaveBeenCalledExactlyOnceWith('/a.jpg', ['vacation'])
  })
})
