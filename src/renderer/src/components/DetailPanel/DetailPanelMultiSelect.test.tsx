import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
let mockSelectedPaths: Set<string>
let mockAllTags: string[]
const mockOpenCompareTab = vi.fn()
const mockAddTagsToSelection = vi.fn()
const mockRemoveTagsFromSelection = vi.fn()

vi.mock('@state', () => ({
  usePreviewTriggerHeld: () => false,
  usePhotoLibrary: () => ({
    state: {
      photosByPath: mockPhotosByPath,
      selectedPaths: mockSelectedPaths,
      tagDescriptions: new Map()
    },
    allTags: mockAllTags,
    openCompareTab: mockOpenCompareTab,
    addTagsToSelection: mockAddTagsToSelection,
    removeTagsFromSelection: mockRemoveTagsFromSelection,
    tagCounts: new Map(),
    tagCoverPhotos: new Map(),
    tagViewCounts: new Map()
  }),
  // TagHoverCardTarget (rendered inside the tag chips here) reads this
  // context directly rather than through usePhotoLibrary.
  useSidebarLibrary: () => ({
    state: { tagDescriptions: new Map() },
    tagCounts: new Map(),
    tagCoverPhotos: new Map(),
    tagViewCounts: new Map()
  }),
  MIN_COMPARE_PHOTOS: 2,
  MAX_COMPARE_PHOTOS: 4
}))

import { DetailPanelMultiSelect } from './DetailPanelMultiSelect'

function makePhoto(filePath: string, tags: string[]): PhotoRecord {
  return {
    id: filePath,
    filePath,
    fileName: filePath.split('/').pop() ?? filePath,
    tags,
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
    viewCount: 0
  }
}

function setSelection(photos: PhotoRecord[]): void {
  mockPhotosByPath = new Map(photos.map((photo) => [photo.filePath, photo]))
  mockSelectedPaths = new Set(photos.map((photo) => photo.filePath))
}

function renderPanel(): void {
  render(
    <MantineProvider>
      <DetailPanelMultiSelect />
    </MantineProvider>
  )
}

describe('DetailPanelMultiSelect', () => {
  beforeEach(() => {
    mockOpenCompareTab.mockClear()
    mockAddTagsToSelection.mockClear()
    mockRemoveTagsFromSelection.mockClear()
  })

  it('shows the selection count', () => {
    mockAllTags = []
    setSelection([makePhoto('/a.jpg', []), makePhoto('/b.jpg', [])])
    renderPanel()

    expect(screen.getByText('2 photos selected')).toBeInTheDocument()
  })

  it('checks a tag only when every selected photo already has it', () => {
    mockAllTags = ['vacation', 'family']
    setSelection([makePhoto('/a.jpg', ['vacation']), makePhoto('/b.jpg', ['vacation', 'family'])])
    renderPanel()

    expect(screen.getByRole('checkbox', { name: 'vacation' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'family' })).not.toBeChecked()
  })

  it('batch-adds a tag to the whole selection when its chip is checked', async () => {
    mockAllTags = ['vacation', 'family']
    setSelection([makePhoto('/a.jpg', ['vacation']), makePhoto('/b.jpg', ['vacation', 'family'])])
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('checkbox', { name: 'family' }))

    expect(mockAddTagsToSelection).toHaveBeenCalledExactlyOnceWith(['family'])
    expect(mockRemoveTagsFromSelection).not.toHaveBeenCalled()
  })

  it('batch-removes a fully-applied tag from the whole selection when unchecked', async () => {
    mockAllTags = ['vacation']
    setSelection([makePhoto('/a.jpg', ['vacation']), makePhoto('/b.jpg', ['vacation'])])
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('checkbox', { name: 'vacation' }))

    expect(mockRemoveTagsFromSelection).toHaveBeenCalledExactlyOnceWith(['vacation'])
    expect(mockAddTagsToSelection).not.toHaveBeenCalled()
  })

  it('shows the Compare button within the min/max photo range', () => {
    mockAllTags = []
    setSelection([makePhoto('/a.jpg', []), makePhoto('/b.jpg', [])])
    renderPanel()

    expect(screen.getByRole('button', { name: /Compare photos/ })).toBeInTheDocument()
  })

  it('hides the Compare button above the max photo count', () => {
    mockAllTags = []
    setSelection([
      makePhoto('/a.jpg', []),
      makePhoto('/b.jpg', []),
      makePhoto('/c.jpg', []),
      makePhoto('/d.jpg', []),
      makePhoto('/e.jpg', [])
    ])
    renderPanel()

    expect(screen.queryByRole('button', { name: /Compare photos/ })).not.toBeInTheDocument()
  })

  it('opens the compare tab with the selected paths when clicked', async () => {
    mockAllTags = []
    setSelection([makePhoto('/a.jpg', []), makePhoto('/b.jpg', [])])
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: /Compare photos/ }))

    expect(mockOpenCompareTab).toHaveBeenCalledExactlyOnceWith(['/a.jpg', '/b.jpg'])
  })

  it('shows an empty-state message when no tags exist yet', () => {
    mockAllTags = []
    setSelection([makePhoto('/a.jpg', [])])
    renderPanel()

    expect(screen.getByText('No tags yet — add one from the Tags panel first.')).toBeInTheDocument()
  })
})
