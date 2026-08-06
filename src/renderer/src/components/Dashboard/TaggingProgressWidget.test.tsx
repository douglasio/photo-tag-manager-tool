import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: { photosByPath: mockPhotosByPath }
  })
}))

// DonutChart drags in Recharts' ResponsiveContainer, which needs real layout
// (ResizeObserver + non-zero measured size) to render anything under jsdom —
// stubbing it out lets these tests focus on the widget's own tagged/untagged
// split instead of fighting the chart library.
const mockDonutChart = vi.fn()
vi.mock('@mantine/charts', () => ({
  DonutChart: (props: { data: unknown }) => {
    mockDonutChart(props)
    return <div data-testid="donut-chart">{JSON.stringify(props.data)}</div>
  }
}))

import { TaggingProgressWidget } from './TaggingProgressWidget'

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
      <TaggingProgressWidget />
    </MantineProvider>
  )
}

describe('TaggingProgressWidget', () => {
  it('shows an empty-state message when the library has no photos', () => {
    setLibrary([])
    renderWidget()

    expect(screen.getByText('Add some photos to see your tagging progress.')).toBeInTheDocument()
    expect(screen.queryByTestId('donut-chart')).not.toBeInTheDocument()
  })

  it('splits the donut by whether each photo has any tags', () => {
    setLibrary([
      makePhoto('/a.jpg', { tags: ['vacation'] }),
      makePhoto('/b.jpg', { tags: [] }),
      makePhoto('/c.jpg', { tags: [] })
    ])
    renderWidget()

    const data = mockDonutChart.mock.calls[0][0].data as { name: string; value: number }[]
    expect(data).toEqual([
      { name: 'Tagged', value: 1, color: 'indigo' },
      { name: 'Untagged', value: 2, color: 'gray' }
    ])
    expect(screen.getByText('1 of 3 tagged')).toBeInTheDocument()
  })
})
