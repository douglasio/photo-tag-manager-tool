import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
const mockOpenPhotoTab = vi.fn()

vi.mock('@state', () => ({
  usePreviewTriggerHeld: () => false,
  useGalleryLibrary: () => ({
    state: { photosByPath: mockPhotosByPath },
    activePhotosByPath: mockPhotosByPath
  }),
  useLibraryActions: () => ({ openPhotoTab: mockOpenPhotoTab }),
  // The real (unstubbed) GalleryHoverPreview rendered by this widget calls
  // usePhotoLibrary() itself for incrementViewCount.
  usePhotoLibrary: () => ({ incrementViewCount: vi.fn() })
}))

// BarChart drags in Recharts' ResponsiveContainer, which needs real layout
// (ResizeObserver + non-zero measured size) to render anything under jsdom —
// stubbing it out lets these tests focus on TopViewedWidget's own data
// selection (filter/sort/slice) instead of fighting the chart library.
const mockBarChart = vi.fn()
vi.mock('@mantine/charts', () => ({
  BarChart: (props: { data: unknown }) => {
    mockBarChart(props)
    return <div data-testid="bar-chart">{JSON.stringify(props.data)}</div>
  }
}))

import {
  type HoverState,
  makeImageBarShape,
  type TopViewedDatum,
  TopViewedWidget
} from './TopViewedWidget'

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
      <TopViewedWidget />
    </MantineProvider>
  )
}

describe('TopViewedWidget', () => {
  beforeEach(() => {
    mockBarChart.mockClear()
  })

  it('shows an empty-state message when no photo has been viewed', () => {
    setLibrary([makePhoto('/a.jpg', { viewCount: 0 })])
    renderWidget()

    expect(
      screen.getByText('Open some photos from the gallery to see them featured here.')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()
  })

  it('excludes photos without a ready thumbnail even if they have views', () => {
    setLibrary([
      makePhoto('/a.jpg', { viewCount: 5, thumbnailStatus: 'pending', thumbnailKey: null }),
      makePhoto('/b.jpg', { viewCount: 3, thumbnailKey: null })
    ])
    renderWidget()

    expect(
      screen.getByText('Open some photos from the gallery to see them featured here.')
    ).toBeInTheDocument()
  })

  it('sorts viewed photos by view count, descending', () => {
    setLibrary([
      makePhoto('/low.jpg', { viewCount: 2 }),
      makePhoto('/high.jpg', { viewCount: 9 }),
      makePhoto('/mid.jpg', { viewCount: 5 })
    ])
    renderWidget()

    const data = mockBarChart.mock.calls[0][0].data as { fileName: string; viewCount: number }[]
    expect(data.filter((d) => d.viewCount > 0).map((d) => d.fileName)).toEqual([
      'high.jpg',
      'mid.jpg',
      'low.jpg'
    ])
  })

  it('caps the chart at the top 5 most-viewed photos', () => {
    setLibrary(Array.from({ length: 8 }, (_, i) => makePhoto(`/p${i}.jpg`, { viewCount: i + 1 })))
    renderWidget()

    const data = mockBarChart.mock.calls[0][0].data as unknown[]
    expect(data).toHaveLength(5)
  })

  it('pads the chart out to a full 5 categories so real bars keep a consistent width', () => {
    setLibrary([makePhoto('/a.jpg', { viewCount: 5 }), makePhoto('/b.jpg', { viewCount: 2 })])
    renderWidget()

    const data = mockBarChart.mock.calls[0][0].data as { viewCount: number }[]
    expect(data).toHaveLength(5)
    expect(data.filter((d) => d.viewCount > 0)).toHaveLength(2)
  })

  it('shows a progress caption while below the 5-viewed goal', () => {
    setLibrary([makePhoto('/a.jpg', { viewCount: 5 }), makePhoto('/b.jpg', { viewCount: 2 })])
    renderWidget()

    expect(screen.getByText('2 of 5 photos viewed')).toBeInTheDocument()
  })

  it('hides the progress caption once the 5-viewed goal is reached', () => {
    setLibrary(Array.from({ length: 5 }, (_, i) => makePhoto(`/p${i}.jpg`, { viewCount: i + 1 })))
    renderWidget()

    expect(screen.queryByText(/photos viewed/)).not.toBeInTheDocument()
  })

  it('does not show the progress caption when no photo has been viewed yet', () => {
    setLibrary([makePhoto('/a.jpg', { viewCount: 0 })])
    renderWidget()

    expect(screen.queryByText(/photos viewed/)).not.toBeInTheDocument()
  })
})

// This renders the actual shape function passed to Recharts (rather than
// going through the mocked BarChart above) — the previous rounds of
// "blacked-out photo" / "lost hover" regressions all lived inside this
// render logic, and a chart-level mock can never catch them.
describe('makeImageBarShape', () => {
  function makeDatum(overrides: Partial<TopViewedDatum> = {}): TopViewedDatum {
    return {
      id: 'a',
      fileName: 'a.jpg',
      viewCount: 7,
      thumbnailUrl: 'photag-thumb://key',
      photo: makePhoto('/a.jpg'),
      ...overrides
    }
  }

  it('renders the photo thumbnail and the view count', () => {
    const shape = makeImageBarShape(false, vi.fn(), vi.fn(), vi.fn())
    const { container } = render(
      <svg>{shape({ x: 0, y: 0, width: 100, height: 30, payload: makeDatum() })}</svg>
    )

    expect(container.querySelector('image')).toHaveAttribute('href', 'photag-thumb://key')
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders nothing for a padding placeholder', () => {
    const shape = makeImageBarShape(false, vi.fn(), vi.fn(), vi.fn())
    const { container } = render(
      <svg>
        {shape({
          x: 0,
          y: 0,
          width: 100,
          height: 30,
          payload: makeDatum({ thumbnailUrl: null })
        })}
      </svg>
    )

    expect(container.querySelector('image')).not.toBeInTheDocument()
    expect(container.querySelector('g')).not.toBeInTheDocument()
  })

  it('sanitizes the file path into a valid SVG id so the clip/gradient reference resolves', () => {
    const shape = makeImageBarShape(false, vi.fn(), vi.fn(), vi.fn())
    const datum = makeDatum({ id: '/Users/me/Pictures/My Photo (2024).jpg' })
    const { container } = render(
      <svg>{shape({ x: 0, y: 0, width: 100, height: 30, payload: datum })}</svg>
    )

    const clipPathEl = container.querySelector('clipPath')!
    const gradientEl = container.querySelector('linearGradient')!
    const image = container.querySelector('image')!
    const gradientRect = container.querySelectorAll('rect')[1]

    expect(clipPathEl.id).toMatch(/^[a-zA-Z0-9_-]+$/)
    expect(gradientEl.id).toMatch(/^[a-zA-Z0-9_-]+$/)
    expect(image.getAttribute('clip-path')).toBe(`url(#${clipPathEl.id})`)
    expect(gradientRect.getAttribute('fill')).toBe(`url(#${gradientEl.id})`)
  })

  it('opens the photo tab when the bar is clicked', () => {
    const onOpen = vi.fn()
    const shape = makeImageBarShape(false, vi.fn(), vi.fn(), onOpen)
    const datum = makeDatum()
    const { container } = render(
      <svg>{shape({ x: 0, y: 0, width: 100, height: 30, payload: datum })}</svg>
    )

    fireEvent.click(container.querySelector('g')!)

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(datum)
  })

  it('reports hover position on mouse move regardless of whether the trigger is held — the parent decides whether to act on it', () => {
    const onHoverMove = vi.fn()
    const shape = makeImageBarShape(false, onHoverMove, vi.fn(), vi.fn())
    const datum = makeDatum()
    const { container } = render(
      <svg>{shape({ x: 0, y: 0, width: 100, height: 30, payload: datum })}</svg>
    )

    fireEvent.mouseMove(container.querySelector('g')!, { clientX: 12, clientY: 34 })

    expect(onHoverMove).toHaveBeenCalledExactlyOnceWith({
      id: 'a',
      position: { x: 12, y: 34 }
    } satisfies HoverState)
  })

  it('calls onHoverLeave on mouse leave', () => {
    const onHoverLeave = vi.fn()
    const shape = makeImageBarShape(true, vi.fn(), onHoverLeave, vi.fn())
    const { container } = render(
      <svg>{shape({ x: 0, y: 0, width: 100, height: 30, payload: makeDatum() })}</svg>
    )

    fireEvent.mouseLeave(container.querySelector('g')!)

    expect(onHoverLeave).toHaveBeenCalledOnce()
  })

  it('keeps the count text within a very short bar instead of letting it spill out', () => {
    const shape = makeImageBarShape(false, vi.fn(), vi.fn(), vi.fn())
    const { container } = render(
      <svg>{shape({ x: 0, y: 100, width: 100, height: 8, payload: makeDatum() })}</svg>
    )

    const text = container.querySelector('text')!
    const textY = Number(text.getAttribute('y'))
    expect(textY).toBeGreaterThanOrEqual(100)
    expect(textY).toBeLessThanOrEqual(108)
  })
})
