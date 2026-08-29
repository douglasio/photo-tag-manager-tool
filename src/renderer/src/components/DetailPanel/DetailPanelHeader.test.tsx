import { MantineProvider } from '@mantine/core'
import type { DisplayPhotoRecord } from '@state'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoMetadata } from '@shared/types'
import { toDisplayMetadata } from '@utils'

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: { activeTab: 'gallery' },
    openPhotoTab: vi.fn(),
    renameFile: vi.fn()
  })
}))

import { DetailPanelHeader } from './DetailPanelHeader'

const emptyMetadata: PhotoMetadata = {
  dateTaken: null,
  cameraMake: null,
  cameraModel: null,
  widthPx: null,
  heightPx: null,
  fileSizeBytes: 0,
  format: 'JPEG',
  comment: null
}

function makePhoto(metadata: Partial<PhotoMetadata> = {}): DisplayPhotoRecord {
  return {
    id: '/a.jpg',
    filePath: '/a.jpg',
    fileName: 'a.jpg',
    tags: [],
    metadata: toDisplayMetadata({ ...emptyMetadata, ...metadata }),
    thumbnailStatus: 'ready',
    thumbnailKey: 'key',
    scanError: null,
    fromCache: false,
    viewCount: 0
  }
}

function renderHeader(metadata: Partial<PhotoMetadata> = {}): void {
  render(
    <MantineProvider>
      <DetailPanelHeader photo={makePhoto(metadata)} />
    </MantineProvider>
  )
}

describe('DetailPanelHeader at-a-glance rows', () => {
  it('shows the date with how long ago it was', () => {
    const threeYearsAgo = new Date()
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
    renderHeader({ dateTaken: threeYearsAgo.toISOString() })

    expect(screen.getByText(/3 years ago/)).toBeInTheDocument()
  })

  it('shows the camera, without repeating a make the model already names', () => {
    renderHeader({ cameraMake: 'NIKON', cameraModel: 'NIKON D3300' })

    expect(screen.getByText('NIKON D3300')).toBeInTheDocument()
  })

  // A dash next to a calendar/camera icon reads as broken, so the whole row
  // is dropped when the EXIF didn't carry the field.
  it('omits both rows entirely when the metadata is missing', () => {
    renderHeader()

    expect(screen.queryByText(/ago/)).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('still renders the view count alongside them', () => {
    renderHeader({ dateTaken: '2020-03-05T14:30:00' })

    expect(screen.getByText(/Viewed/)).toBeInTheDocument()
  })
})
