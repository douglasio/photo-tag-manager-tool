import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
const mockGetThrowbackYearSample = vi.fn()
const mockOpenPhotoTab = vi.fn()

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: { photosByPath: mockPhotosByPath, galleryAnimationsEnabled: true },
    getThrowbackYearSample: mockGetThrowbackYearSample,
    openPhotoTab: mockOpenPhotoTab
  })
}))

import { PhotosFromYearWidget } from './PhotosFromYearWidget'

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

function renderWidget(): ReturnType<typeof render> {
  return render(
    <MantineProvider>
      <PhotosFromYearWidget />
    </MantineProvider>
  )
}

describe('PhotosFromYearWidget', () => {
  beforeEach(() => {
    mockPhotosByPath = new Map()
    mockGetThrowbackYearSample.mockReset().mockResolvedValue(null)
    mockOpenPhotoTab.mockClear()
  })

  it('shows a sample from a past year once loaded', async () => {
    mockGetThrowbackYearSample.mockResolvedValue({ year: 2019, filePaths: [] })
    renderWidget()

    expect(await screen.findByText('Photos from 2019')).toBeInTheDocument()
  })

  it('shows an empty-state message when no year sample is available', async () => {
    mockGetThrowbackYearSample.mockResolvedValue(null)
    renderWidget()

    expect(
      await screen.findByText('Add photos spanning more than one year to see photos from the past.')
    ).toBeInTheDocument()
  })

  it('opens the photo tab when a tile is clicked', async () => {
    const user = userEvent.setup()
    const photo = makePhoto('/a.jpg')
    mockPhotosByPath = new Map([[photo.filePath, photo]])
    mockGetThrowbackYearSample.mockResolvedValue({ year: 2019, filePaths: ['/a.jpg'] })
    renderWidget()

    await user.click(await screen.findByRole('img'))

    expect(mockOpenPhotoTab).toHaveBeenCalledExactlyOnceWith('/a.jpg')
  })
})
