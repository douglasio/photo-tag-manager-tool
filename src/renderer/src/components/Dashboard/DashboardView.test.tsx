import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
let mockStatus: string
const mockAddFolder = vi.fn()

vi.mock('@state', () => ({
  usePreviewTriggerHeld: () => false,
  usePhotoLibrary: () => ({
    activePhotosByPath: mockPhotosByPath,
    addFolder: mockAddFolder,
    state: { status: mockStatus, people: [] }
  })
}))

// None of these widgets' own behavior is relevant here — DashboardView's job
// is just deciding whether to show them at all vs. the empty state — so
// each is stubbed to a trivial placeholder instead of dragging in its own
// usePhotoLibrary requirements.
vi.mock('@components', () => ({
  FeaturedPersonWidget: () => <div>FeaturedPersonWidget</div>,
  FeaturedTagWidget: () => <div>FeaturedTagWidget</div>,
  NameThisPersonWidget: () => <div>NameThisPersonWidget</div>,
  PhotoScanProgressIndicator: ({ label }: { label?: string }) => <div>{label}</div>,
  PhotosFromYearWidget: () => <div>PhotosFromYearWidget</div>,
  RecentlyAddedWidget: () => <div>RecentlyAddedWidget</div>,
  TaggingProgressWidget: () => <div>TaggingProgressWidget</div>,
  TagThisPhotoWidget: () => <div>TagThisPhotoWidget</div>,
  TimeWarpWidget: () => <div>TimeWarpWidget</div>,
  TopTagsWidget: () => <div>TopTagsWidget</div>,
  TopViewedWidget: () => <div>TopViewedWidget</div>,
  WelcomeWidget: () => <div>WelcomeWidget</div>
}))

import { DashboardView } from './DashboardView'

function makePhoto(filePath: string): PhotoRecord {
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
    viewCount: 0
  }
}

function renderView(): void {
  render(
    <MantineProvider>
      <DashboardView />
    </MantineProvider>
  )
}

describe('DashboardView', () => {
  it('shows an EmptyState with an Add Folder action when the library has no photos', async () => {
    mockPhotosByPath = new Map()
    mockStatus = 'idle'
    const user = userEvent.setup()
    renderView()

    expect(screen.getByText('No photos yet')).toBeInTheDocument()
    expect(screen.queryByText('WelcomeWidget')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add Folder' }))
    expect(mockAddFolder).toHaveBeenCalledOnce()
  })

  it('shows the widget grid instead of the EmptyState once the library has photos', () => {
    mockPhotosByPath = new Map([['/a.jpg', makePhoto('/a.jpg')]])
    mockStatus = 'idle'
    renderView()

    expect(screen.queryByText('No photos yet')).not.toBeInTheDocument()
    expect(screen.getByText('WelcomeWidget')).toBeInTheDocument()
    expect(screen.getByText('TimeWarpWidget')).toBeInTheDocument()
  })

  it('shows a scanning indicator instead of the Add Folder EmptyState while the startup scan is still running', () => {
    mockPhotosByPath = new Map()
    mockStatus = 'scanning'
    renderView()

    expect(screen.getByText('Scanning for photos…')).toBeInTheDocument()
    expect(screen.queryByText('No photos yet')).not.toBeInTheDocument()
  })

  it('shows the scanning indicator instead of the widget grid even when the library already has photos', () => {
    mockPhotosByPath = new Map([['/a.jpg', makePhoto('/a.jpg')]])
    mockStatus = 'scanning'
    renderView()

    expect(screen.getByText('Scanning for photos…')).toBeInTheDocument()
    expect(screen.queryByText('WelcomeWidget')).not.toBeInTheDocument()
  })
})
