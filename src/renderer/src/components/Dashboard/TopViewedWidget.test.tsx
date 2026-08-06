import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: { photosByPath: mockPhotosByPath }
  })
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

import { TopViewedWidget } from './TopViewedWidget'

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
    expect(data.map((d) => d.fileName)).toEqual(['high.jpg', 'mid.jpg', 'low.jpg'])
  })

  it('caps the chart at the top 5 most-viewed photos', () => {
    setLibrary(Array.from({ length: 8 }, (_, i) => makePhoto(`/p${i}.jpg`, { viewCount: i + 1 })))
    renderWidget()

    const data = mockBarChart.mock.calls[0][0].data as unknown[]
    expect(data).toHaveLength(5)
  })
})
