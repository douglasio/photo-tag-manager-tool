import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

let mockTagCounts: Map<string, number>

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    tagCounts: mockTagCounts
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

import { TopTagsWidget } from './TopTagsWidget'

function renderWidget(): void {
  render(
    <MantineProvider>
      <TopTagsWidget />
    </MantineProvider>
  )
}

describe('TopTagsWidget', () => {
  it('shows an empty-state message when no tag has been used', () => {
    mockTagCounts = new Map()
    renderWidget()

    expect(screen.getByText('Tag some photos to see your most-used tags here.')).toBeInTheDocument()
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()
  })

  it('ranks the top tags by photo count, descending, capped at 5', () => {
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
})
