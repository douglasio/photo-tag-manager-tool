import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
let mockTagCounts: Map<string, number>
const mockSetTagFilter = vi.fn()
const mockSetActiveTab = vi.fn()

vi.mock('@state', () => ({
  usePreviewTriggerHeld: () => false,
  useGalleryLibrary: () => ({ activePhotosByPath: mockPhotosByPath }),
  useSidebarLibrary: () => ({ tagCounts: mockTagCounts }),
  useLibraryActions: () => ({
    setTagFilter: mockSetTagFilter,
    setActiveTab: mockSetActiveTab
  })
}))

// BarChart drags in Recharts' ResponsiveContainer, which needs real layout
// (ResizeObserver + non-zero measured size) to render anything under jsdom —
// stubbing it out lets these tests focus on the widget's own ranking logic
// instead of fighting the chart library.
const mockBarChart = vi.fn()
vi.mock('@mantine/charts', () => ({
  BarChart: (props: { data: unknown }) => {
    mockBarChart(props)
    return <div data-testid="bar-chart">{JSON.stringify(props.data)}</div>
  }
}))

import { makeCountBarShape, makeTagTick, type TopTagDatum, TopTagsWidget } from './TopTagsWidget'

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
      <TopTagsWidget />
    </MantineProvider>
  )
}

describe('TopTagsWidget', () => {
  it('shows an empty-state message when no tag has been used', () => {
    setLibrary([])
    mockTagCounts = new Map()
    renderWidget()

    expect(screen.getByText('Tag some photos to see your most-used tags here.')).toBeInTheDocument()
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()
  })

  it('ranks the top tags by photo count, descending, capped at 5', () => {
    setLibrary([])
    mockTagCounts = new Map([
      ['a', 3],
      ['b', 5],
      ['c', 1],
      ['d', 4],
      ['e', 2],
      ['f', 6]
    ])
    renderWidget()

    const data = mockBarChart.mock.calls[0][0].data as { tag: string; count: number }[]
    expect(data.map((d) => d.tag)).toEqual(['f', 'b', 'd', 'a', 'e'])
  })

  it("attaches each tag's own ready-thumbnail photos as candidate block images", () => {
    setLibrary([
      makePhoto('/a.jpg', { tags: ['vacation'] }),
      makePhoto('/b.jpg', { tags: ['vacation'] }),
      makePhoto('/c.jpg', { tags: ['other'] })
    ])
    mockTagCounts = new Map([
      ['vacation', 2],
      ['other', 1]
    ])
    renderWidget()

    // Photos are picked lazily, one tag per render, so the settled data
    // (with thumbnailUrls actually populated) is the *last* BarChart call,
    // not necessarily the first.
    const lastCall = mockBarChart.mock.calls[mockBarChart.mock.calls.length - 1][0]
    const data = lastCall.data as TopTagDatum[]
    const vacation = data.find((d) => d.tag === 'vacation')!
    expect(vacation.thumbnailUrls).toHaveLength(2)
    expect(vacation.thumbnailUrls.every((url) => url.startsWith('photag-thumb://'))).toBe(true)
  })

  it("excludes photos without a ready thumbnail from a tag's candidate images", () => {
    setLibrary([
      makePhoto('/a.jpg', { tags: ['vacation'] }),
      makePhoto('/b.jpg', { tags: ['vacation'], thumbnailStatus: 'pending', thumbnailKey: null })
    ])
    mockTagCounts = new Map([['vacation', 2]])
    renderWidget()

    const lastCall = mockBarChart.mock.calls[mockBarChart.mock.calls.length - 1][0]
    const data = lastCall.data as TopTagDatum[]
    expect(data[0].thumbnailUrls).toHaveLength(1)
  })
})

// Renders the actual shape/tick functions passed to Recharts, rather than
// going through the mocked BarChart above, so a broken bar or a lost click
// handler shows up as a real test failure.
describe('makeTagTick', () => {
  it('renders the tag name and navigates to it on click', () => {
    const onSelect = vi.fn()
    const tick = makeTagTick(onSelect)
    render(<svg>{tick({ x: 10, y: 20, payload: { value: 'vacation' } })}</svg>)

    fireEvent.click(screen.getByText('vacation'))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('vacation')
  })

  it('renders nothing when the tick has no value', () => {
    const tick = makeTagTick(vi.fn())
    const { container } = render(<svg>{tick({ x: 10, y: 20, payload: {} })}</svg>)

    expect(container.querySelector('text')).not.toBeInTheDocument()
  })

  it('truncates a long tag name with an ellipsis, but still navigates by its full name', () => {
    const onSelect = vi.fn()
    const tick = makeTagTick(onSelect)
    const longTag = 'a-very-long-tag-name-that-would-overflow'
    const { container } = render(<svg>{tick({ x: 10, y: 20, payload: { value: longTag } })}</svg>)

    const textEl = container.querySelector('text')!
    expect(textEl.textContent).not.toEqual(longTag)
    expect(textEl.textContent).toMatch(/…$/)
    expect(textEl.textContent!.length).toBeLessThan(longTag.length)

    fireEvent.click(textEl)
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(longTag)
  })

  it('does not truncate a short tag name', () => {
    const tick = makeTagTick(vi.fn())
    const { container } = render(<svg>{tick({ x: 10, y: 20, payload: { value: 'short' } })}</svg>)

    expect(container.querySelector('text')!.textContent).toBe('short')
  })
})

describe('makeCountBarShape', () => {
  function makeDatum(overrides: Partial<TopTagDatum> = {}): TopTagDatum {
    return { tag: 'vacation', count: 5, thumbnailUrls: [], ...overrides }
  }

  it('renders the count and navigates to the tag on click', () => {
    const onSelect = vi.fn()
    const shape = makeCountBarShape(onSelect)
    const { container } = render(
      <svg>{shape({ x: 0, y: 0, width: 100, height: 30, payload: makeDatum() })}</svg>
    )

    expect(screen.getByText('5')).toBeInTheDocument()
    fireEvent.click(container.querySelector('g')!)

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('vacation')
  })

  it('renders nothing without a payload', () => {
    const shape = makeCountBarShape(vi.fn())
    const { container } = render(<svg>{shape({ x: 0, y: 0, width: 100, height: 30 })}</svg>)

    expect(container.querySelector('g')).not.toBeInTheDocument()
  })

  it('falls back to a solid color bar when there are no candidate photos yet', () => {
    const shape = makeCountBarShape(vi.fn())
    const { container } = render(
      <svg>{shape({ x: 0, y: 0, width: 100, height: 30, payload: makeDatum() })}</svg>
    )

    expect(container.querySelector('.top-tags-bar-rect')).toBeInTheDocument()
    expect(container.querySelector('image')).not.toBeInTheDocument()
  })

  it('tiles same-width photo blocks across the bar when candidates are available', () => {
    const shape = makeCountBarShape(vi.fn())
    const urls = ['photag-thumb://a', 'photag-thumb://b', 'photag-thumb://c']
    const { container } = render(
      <svg>
        {shape({ x: 0, y: 0, width: 108, height: 30, payload: makeDatum({ thumbnailUrls: urls }) })}
      </svg>
    )

    const images = Array.from(container.querySelectorAll('image'))
    expect(images.length).toBeGreaterThan(0)
    expect(container.querySelector('.top-tags-bar-rect')).not.toBeInTheDocument()

    const widths = images.map((img) => Number(img.getAttribute('width')))
    for (const w of widths) expect(w).toBeCloseTo(widths[0])
  })

  it('cycles through candidate photos when more blocks fit than photos are available', () => {
    const shape = makeCountBarShape(vi.fn())
    const { container } = render(
      <svg>
        {shape({
          x: 0,
          y: 0,
          width: 200,
          height: 30,
          payload: makeDatum({ thumbnailUrls: ['photag-thumb://only'] })
        })}
      </svg>
    )

    const hrefs = Array.from(container.querySelectorAll('image')).map((img) =>
      img.getAttribute('href')
    )
    expect(hrefs.length).toBeGreaterThan(1)
    expect(hrefs.every((href) => href === 'photag-thumb://only')).toBe(true)
  })
})
