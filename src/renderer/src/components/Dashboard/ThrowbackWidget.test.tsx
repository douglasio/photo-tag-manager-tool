import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AiScanProgress, PhotoRecord, ThrowbackEntry } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
let mockAiTagSuggestionsEnabled: boolean
let mockAiScanProgress: AiScanProgress | null
const mockGetThrowbackSimilarity = vi.fn()
const mockGetThrowbackYearSample = vi.fn()
const mockGetThrowbackPreview = vi.fn()
const mockEnableAiFeatures = vi.fn()
const mockOpenPhotoTab = vi.fn()

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: {
      photosByPath: mockPhotosByPath,
      aiTagSuggestionsEnabled: mockAiTagSuggestionsEnabled,
      aiScanProgress: mockAiScanProgress
    },
    getThrowbackSimilarity: mockGetThrowbackSimilarity,
    getThrowbackYearSample: mockGetThrowbackYearSample,
    getThrowbackPreview: mockGetThrowbackPreview,
    enableAiFeatures: mockEnableAiFeatures,
    openPhotoTab: mockOpenPhotoTab
  })
}))

import { ThrowbackWidget } from './ThrowbackWidget'

function renderWidget(): ReturnType<typeof render> {
  return render(
    <MantineProvider>
      <ThrowbackWidget />
    </MantineProvider>
  )
}

describe('ThrowbackWidget', () => {
  beforeEach(() => {
    mockPhotosByPath = new Map()
    mockAiTagSuggestionsEnabled = false
    mockAiScanProgress = null
    mockGetThrowbackSimilarity.mockReset().mockResolvedValue(null)
    mockGetThrowbackYearSample.mockReset().mockResolvedValue(null)
    mockGetThrowbackPreview.mockReset().mockResolvedValue(null)
    mockEnableAiFeatures.mockReset()
  })

  it('shows the timeline when AI is enabled and similarity data exists', async () => {
    mockAiTagSuggestionsEnabled = true
    const similarity: ThrowbackEntry[] = [
      { year: 2020, filePath: '/a.jpg' },
      { year: 2021, filePath: '/b.jpg' }
    ]
    mockGetThrowbackSimilarity.mockResolvedValue(similarity)
    renderWidget()

    expect(await screen.findByText('2020')).toBeInTheDocument()
    expect(screen.getByText('2021')).toBeInTheDocument()
  })

  it('skips the similarity query entirely while AI is disabled', async () => {
    // Regression: this used to fetch (and cluster) similarity data
    // unconditionally, even though it's never rendered while AI is off —
    // wasted, and slow enough on a large cached-embeddings backlog to make
    // the widget look stuck loading for no visible reason.
    mockAiTagSuggestionsEnabled = false
    mockGetThrowbackYearSample.mockResolvedValue({ year: 2019, filePaths: [] })
    renderWidget()

    await screen.findByText('Photos from 2019')
    expect(mockGetThrowbackSimilarity).not.toHaveBeenCalled()
  })

  it('hides an already-loaded timeline immediately once AI is disabled, before any refetch resolves', async () => {
    // The render gate (not just the fetch-skip above) is what has to hide
    // this the instant aiTagSuggestionsEnabled flips, since the state from
    // the earlier fetch is still sitting in `similarity` until a refetch
    // — which this test never lets resolve — replaces it.
    mockAiTagSuggestionsEnabled = true
    mockGetThrowbackSimilarity.mockResolvedValue([{ year: 2020, filePath: '/a.jpg' }])
    const { rerender } = renderWidget()
    expect(await screen.findByText('2020')).toBeInTheDocument()

    mockAiTagSuggestionsEnabled = false
    mockGetThrowbackYearSample.mockReturnValue(new Promise(() => undefined))
    rerender(
      <MantineProvider>
        <ThrowbackWidget />
      </MantineProvider>
    )

    expect(screen.queryByText('2020')).not.toBeInTheDocument()
  })

  it('refetches once a scan finishes, replacing the fallback with the new timeline', async () => {
    mockAiTagSuggestionsEnabled = true
    mockGetThrowbackSimilarity.mockResolvedValueOnce(null)
    mockGetThrowbackYearSample.mockResolvedValueOnce({ year: 2019, filePaths: [] })
    mockAiScanProgress = { phase: 'embedding', done: 1, total: 2 }
    const { rerender } = renderWidget()

    expect(await screen.findByText('Photos from 2019')).toBeInTheDocument()

    mockGetThrowbackSimilarity.mockResolvedValueOnce([
      { year: 2020, filePath: '/a.jpg' },
      { year: 2021, filePath: '/b.jpg' }
    ])
    mockAiScanProgress = null
    rerender(
      <MantineProvider>
        <ThrowbackWidget />
      </MantineProvider>
    )

    expect(await screen.findByText('2020')).toBeInTheDocument()
  })

  it('does not show "Enable Time Warp" once AI is already enabled', async () => {
    mockAiTagSuggestionsEnabled = true
    mockGetThrowbackYearSample.mockResolvedValue({ year: 2019, filePaths: [] })
    renderWidget()

    await screen.findByText('Photos from 2019')
    expect(screen.queryByRole('button', { name: 'Enable Time Warp' })).not.toBeInTheDocument()
  })
})
