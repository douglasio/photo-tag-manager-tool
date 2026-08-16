import { useEffect } from 'react'

import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

const mockClosePhotoTab = vi.fn()
const mockRotatePhoto = vi.fn().mockResolvedValue(undefined)
const mockNavigateToPhoto = vi.fn()
const mockConsumeNavDirection = vi.fn().mockReturnValue(null)
const mockConsumeVisualization = vi.fn().mockReturnValue(null)
const mockIncrementViewCount = vi.fn().mockResolvedValue(undefined)

let mockVisiblePhotos: PhotoRecord[] = []
let mockActiveTab = ''

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: {
      activeTab: mockActiveTab,
      galleryAnimationsEnabled: false,
      magazineTitle: 'Mag',
      newspaperTitle: 'News',
      dvdStudioName: 'Studio',
      artGalleryName: 'Gallery'
    },
    closePhotoTab: mockClosePhotoTab,
    rotatePhoto: mockRotatePhoto,
    visiblePhotos: mockVisiblePhotos,
    navigateToPhoto: mockNavigateToPhoto,
    consumeNavDirection: mockConsumeNavDirection,
    consumeVisualization: mockConsumeVisualization,
    incrementViewCount: mockIncrementViewCount
  })
}))

vi.mock('@components', () => ({
  ZoomToolbar: (props: { scale: number }) => <div>ZoomToolbar:{props.scale}</div>
}))

const fakeZoom = {
  scale: 2.5,
  setScale: vi.fn(),
  zoomToFit: vi.fn(),
  zoomToNativeSize: vi.fn(),
  zoomOut: vi.fn(),
  zoomIn: vi.fn(),
  min: 0.5,
  max: 5
}

vi.mock('./MagazineCoverView', () => ({
  // Reports a fake zoom on mount, the same way the real component does via
  // usePannableZoom + onZoomReady — verifies PhotoView actually wires it
  // through to its own footer ZoomToolbar instead of a disconnected copy.
  MagazineCoverView: ({ onZoomReady }: { onZoomReady: (zoom: typeof fakeZoom) => void }) => {
    useEffect(() => onZoomReady(fakeZoom), [onZoomReady])
    return <div>MagazineCoverView</div>
  }
}))
vi.mock('./NewspaperCoverView', () => ({
  NewspaperCoverView: () => <div>NewspaperCoverView</div>
}))
vi.mock('./DvdCoverView', () => ({ DvdCoverView: () => <div>DvdCoverView</div> }))
vi.mock('./ArtGalleryView', () => ({ ArtGalleryView: () => <div>ArtGalleryView</div> }))
vi.mock('./MovieTheaterView', () => ({ MovieTheaterView: () => <div>MovieTheaterView</div> }))

import { PhotoView } from './PhotoView'

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

function renderView(photo: PhotoRecord): void {
  mockActiveTab = photo.filePath
  render(
    <MantineProvider>
      <PhotoView photo={photo} />
    </MantineProvider>
  )
}

describe('PhotoView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRotatePhoto.mockResolvedValue(undefined)
    mockConsumeNavDirection.mockReturnValue(null)
    mockConsumeVisualization.mockReturnValue(null)
    mockVisiblePhotos = []
  })

  it('renders the plain view (no theme component) when no visualization is active', () => {
    renderView(makePhoto('/a.jpg'))
    expect(screen.queryByText('MagazineCoverView')).not.toBeInTheDocument()
    expect(screen.getByText('ZoomToolbar:1')).toBeInTheDocument()
  })

  it('switches to the matching theme view, and only that one, when a visualization button is clicked', async () => {
    const user = userEvent.setup()
    renderView(makePhoto('/a.jpg'))

    await user.click(screen.getByRole('button', { name: 'Magazine cover visualization' }))

    expect(screen.getByText('MagazineCoverView')).toBeInTheDocument()
    expect(screen.queryByText('NewspaperCoverView')).not.toBeInTheDocument()
    expect(screen.queryByText('DvdCoverView')).not.toBeInTheDocument()
    expect(screen.queryByText('ArtGalleryView')).not.toBeInTheDocument()
    expect(screen.queryByText('MovieTheaterView')).not.toBeInTheDocument()
  })

  it("renders the footer ZoomToolbar from the active theme's own reported zoom", async () => {
    const user = userEvent.setup()
    renderView(makePhoto('/a.jpg'))

    await user.click(screen.getByRole('button', { name: 'Magazine cover visualization' }))

    expect(screen.getByText('ZoomToolbar:2.5')).toBeInTheDocument()
  })

  it('returns to the plain view when the exit-visualization button is clicked', async () => {
    const user = userEvent.setup()
    renderView(makePhoto('/a.jpg'))

    await user.click(screen.getByRole('button', { name: 'DVD cover visualization' }))
    expect(screen.getByText('DvdCoverView')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Exit visualization view' }))
    expect(screen.queryByText('DvdCoverView')).not.toBeInTheDocument()
  })

  it('shows rotate controls for a rotatable format (JPEG)', () => {
    renderView(
      makePhoto('/a.jpg', { metadata: { ...makePhoto('/a.jpg').metadata, format: 'JPEG' } })
    )
    expect(screen.getByRole('button', { name: 'Rotate left' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rotate right' })).toBeInTheDocument()
  })

  it('hides rotate controls for a non-rotatable format (PNG)', () => {
    renderView(
      makePhoto('/a.png', { metadata: { ...makePhoto('/a.png').metadata, format: 'PNG' } })
    )
    expect(screen.queryByRole('button', { name: 'Rotate left' })).not.toBeInTheDocument()
  })

  it('calls rotatePhoto with the clicked direction', async () => {
    const user = userEvent.setup()
    renderView(makePhoto('/a.jpg'))

    await user.click(screen.getByRole('button', { name: 'Rotate right' }))
    expect(mockRotatePhoto).toHaveBeenCalledWith('/a.jpg', 'right')

    await user.click(screen.getByRole('button', { name: 'Rotate left' }))
    expect(mockRotatePhoto).toHaveBeenCalledWith('/a.jpg', 'left')
  })

  it('reverts the optimistic rotation when the rotate call rejects', async () => {
    mockRotatePhoto.mockRejectedValueOnce(new Error('write failed'))
    const user = userEvent.setup()
    renderView(makePhoto('/a.jpg'))

    await user.click(screen.getByRole('button', { name: 'Rotate right' }))
    // Rejection is handled asynchronously (a microtask); flush it before asserting.
    await Promise.resolve()
    await Promise.resolve()

    expect(mockRotatePhoto).toHaveBeenCalledWith('/a.jpg', 'right')
  })

  it('increments the view count exactly once per mount', () => {
    renderView(makePhoto('/a.jpg'))
    expect(mockIncrementViewCount).toHaveBeenCalledExactlyOnceWith('/a.jpg')
  })

  it('ignores an untrusted (synthetic) Escape keydown', () => {
    renderView(makePhoto('/a.jpg'))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(mockClosePhotoTab).not.toHaveBeenCalled()
  })

  it('navigates to the next photo on ArrowRight when this tab is active', () => {
    const a = makePhoto('/a.jpg')
    const b = makePhoto('/b.jpg')
    mockVisiblePhotos = [a, b]
    renderView(a)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))

    expect(mockNavigateToPhoto).toHaveBeenCalledWith('/a.jpg', '/b.jpg', 'right', 'none')
  })

  it('does not navigate past the last photo', () => {
    const a = makePhoto('/a.jpg')
    const b = makePhoto('/b.jpg')
    mockVisiblePhotos = [a, b]
    renderView(b)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))

    expect(mockNavigateToPhoto).not.toHaveBeenCalled()
  })
})
