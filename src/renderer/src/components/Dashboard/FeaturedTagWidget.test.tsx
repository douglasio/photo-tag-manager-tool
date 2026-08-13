import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
let mockTagCounts: Map<string, number>
let mockAllTags: string[]
const mockTagDescriptions = new Map<string, string>()
const mockOpenPhotoTab = vi.fn()
const mockSetTagFilter = vi.fn()
const mockSetActiveTab = vi.fn()
const mockSetSettingsModalOpened = vi.fn()

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: { photosByPath: mockPhotosByPath, tagDescriptions: mockTagDescriptions },
    activePhotosByPath: mockPhotosByPath,
    tagCounts: mockTagCounts,
    allTags: mockAllTags,
    openPhotoTab: mockOpenPhotoTab,
    setTagFilter: mockSetTagFilter,
    setActiveTab: mockSetActiveTab,
    setSettingsModalOpened: mockSetSettingsModalOpened
  })
}))

import { FeaturedTagWidget } from './FeaturedTagWidget'

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
  const counts = new Map<string, number>()
  for (const photo of photos) {
    for (const tag of photo.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  mockTagCounts = counts
  mockAllTags = Array.from(counts.keys()).sort()
}

function renderWidget(): ReturnType<typeof render> {
  return render(
    <MantineProvider>
      <FeaturedTagWidget />
    </MantineProvider>
  )
}

function threeVacationPhotos(): PhotoRecord[] {
  return [
    makePhoto('/a.jpg', { tags: ['vacation'] }),
    makePhoto('/b.jpg', { tags: ['vacation'] }),
    makePhoto('/c.jpg', { tags: ['vacation'] })
  ]
}

describe('FeaturedTagWidget', () => {
  beforeEach(() => {
    mockOpenPhotoTab.mockClear()
    mockSetTagFilter.mockClear()
    mockSetActiveTab.mockClear()
    mockSetSettingsModalOpened.mockClear()
  })

  describe('onboarding (no tag has reached the threshold)', () => {
    it('shows the onboarding checklist when the library is empty', () => {
      setLibrary([])
      renderWidget()

      expect(
        screen.getByText('Tag 3 or more photos with the same tag to feature them here.')
      ).toBeInTheDocument()
      expect(screen.getByText('Add photos to your library')).toBeInTheDocument()
    })

    it('does not feature a tag with fewer than 3 photos even if it is the closest', () => {
      setLibrary([
        makePhoto('/a.jpg', { tags: ['vacation'] }),
        makePhoto('/b.jpg', { tags: ['vacation'] })
      ])
      renderWidget()

      expect(screen.queryByText('#vacation')).not.toBeInTheDocument()
    })

    it("opens Settings when the first step's link is clicked", async () => {
      const user = userEvent.setup()
      setLibrary([])
      renderWidget()

      await user.click(screen.getByRole('button', { name: 'Open Settings' }))

      expect(mockSetSettingsModalOpened).toHaveBeenCalledExactlyOnceWith(true)
    })

    it("switches to the gallery when the second step's link is clicked", async () => {
      const user = userEvent.setup()
      // photosByPath non-empty completes step 1, making step 2 the active one.
      setLibrary([makePhoto('/a.jpg')])
      renderWidget()

      await user.click(screen.getByRole('button', { name: 'Open Gallery' }))

      expect(mockSetActiveTab).toHaveBeenCalledExactlyOnceWith('gallery')
    })

    it("hides a completed step's link", () => {
      // Photos exist (step 1 done) and a tag has 1 use (step 2 done), so
      // only step 3's bullet is active — steps 1 and 2's links should be gone.
      setLibrary([makePhoto('/a.jpg', { tags: ['vacation'] })])
      renderWidget()

      expect(screen.queryByRole('button', { name: 'Open Settings' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Open Gallery' })).not.toBeInTheDocument()
      expect(screen.getByText('Add photos to your library')).toBeInTheDocument()
    })
  })

  describe('featured tag (a tag has reached the threshold)', () => {
    it('features the qualifying tag with its photo count and a collage of its photos', () => {
      setLibrary(threeVacationPhotos())
      renderWidget()

      expect(screen.getByText('#vacation')).toBeInTheDocument()
      expect(screen.getByText('3 photos')).toBeInTheDocument()
      // Order is randomized (not necessarily recency), but with only 3
      // candidates and room for 4, all of them should appear.
      expect(
        screen
          .getAllByRole('img')
          .map((img) => img.getAttribute('alt'))
          .sort()
      ).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
    })

    it('keeps the same featured tag across rerenders even as another tag overtakes it', () => {
      setLibrary(threeVacationPhotos())
      const { rerender } = renderWidget()
      expect(screen.getByText('#vacation')).toBeInTheDocument()

      setLibrary([
        ...threeVacationPhotos(),
        makePhoto('/d.jpg', { tags: ['family'] }),
        makePhoto('/e.jpg', { tags: ['family'] }),
        makePhoto('/f.jpg', { tags: ['family'] }),
        makePhoto('/g.jpg', { tags: ['family'] })
      ])
      rerender(
        <MantineProvider>
          <FeaturedTagWidget />
        </MantineProvider>
      )
      expect(screen.getByText('#vacation')).toBeInTheDocument()
    })

    it('keeps the same random photo selection across rerenders instead of reshuffling', () => {
      const photos = Array.from({ length: 6 }, (_, i) =>
        makePhoto(`/p${i}.jpg`, { tags: ['vacation'] })
      )
      setLibrary(photos)
      const { rerender } = renderWidget()
      const firstPass = screen
        .getAllByRole('img')
        .map((img) => img.getAttribute('alt'))
        .sort()

      // A fresh Map with the same underlying photos — mimics an unrelated
      // library update triggering a rerender, not a real change in candidates.
      setLibrary(photos)
      rerender(
        <MantineProvider>
          <FeaturedTagWidget />
        </MantineProvider>
      )
      const secondPass = screen
        .getAllByRole('img')
        .map((img) => img.getAttribute('alt'))
        .sort()

      expect(secondPass).toEqual(firstPass)
    })

    it('opens a photo in a new tab when it is clicked', async () => {
      const user = userEvent.setup()
      setLibrary(threeVacationPhotos())
      renderWidget()

      const firstImage = screen.getAllByRole('img')[0]
      await user.click(firstImage.closest('button')!)

      expect(mockOpenPhotoTab).toHaveBeenCalledExactlyOnceWith(`/${firstImage.getAttribute('alt')}`)
    })

    it('filters the gallery by the featured tag when the tag name is clicked', async () => {
      const user = userEvent.setup()
      setLibrary(threeVacationPhotos())
      renderWidget()

      await user.click(screen.getByText('#vacation'))

      expect(mockSetTagFilter).toHaveBeenCalledExactlyOnceWith('vacation')
      expect(mockSetActiveTab).toHaveBeenCalledExactlyOnceWith('gallery')
    })

    it('filters the gallery by the featured tag when the photo-count badge is clicked', async () => {
      const user = userEvent.setup()
      setLibrary(threeVacationPhotos())
      renderWidget()

      await user.click(screen.getByRole('button', { name: '3 photos' }))

      expect(mockSetTagFilter).toHaveBeenCalledExactlyOnceWith('vacation')
      expect(mockSetActiveTab).toHaveBeenCalledExactlyOnceWith('gallery')
    })
  })
})
