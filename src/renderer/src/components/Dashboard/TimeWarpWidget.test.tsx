import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AiScanProgress, PhotoRecord, ThrowbackEntry } from '@shared/types'

let mockPhotosByPath: Map<string, PhotoRecord>
let mockAiTagSuggestionsEnabled: boolean
let mockAiScanProgress: AiScanProgress | null
const mockGetThrowbackSimilarity = vi.fn()
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
    getThrowbackPreview: mockGetThrowbackPreview,
    enableAiFeatures: mockEnableAiFeatures,
    openPhotoTab: mockOpenPhotoTab
  })
}))

import { TimeWarpWidget } from './TimeWarpWidget'

function renderWidget(): ReturnType<typeof render> {
  return render(
    <MantineProvider>
      <TimeWarpWidget />
    </MantineProvider>
  )
}

describe('TimeWarpWidget', () => {
  beforeEach(() => {
    mockPhotosByPath = new Map()
    mockAiTagSuggestionsEnabled = false
    mockAiScanProgress = null
    mockGetThrowbackSimilarity.mockReset().mockResolvedValue(null)
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

  it('caps the real timeline at 5 entries', async () => {
    mockAiTagSuggestionsEnabled = true
    mockGetThrowbackSimilarity.mockResolvedValue([
      { year: 2017, filePath: '/a.jpg' },
      { year: 2018, filePath: '/b.jpg' },
      { year: 2019, filePath: '/c.jpg' },
      { year: 2020, filePath: '/d.jpg' },
      { year: 2021, filePath: '/e.jpg' },
      { year: 2022, filePath: '/f.jpg' }
    ])
    renderWidget()

    await screen.findByText('2017')
    expect(screen.getByText('2018')).toBeInTheDocument()
    expect(screen.getByText('2019')).toBeInTheDocument()
    expect(screen.getByText('2020')).toBeInTheDocument()
    expect(screen.getByText('2021')).toBeInTheDocument()
    expect(screen.queryByText('2022')).not.toBeInTheDocument()
  })

  it('skips the similarity query entirely while AI is disabled', async () => {
    mockAiTagSuggestionsEnabled = false
    renderWidget()

    await screen.findByRole('button', { name: 'Enable AI Features' })
    expect(mockGetThrowbackSimilarity).not.toHaveBeenCalled()
  })

  it('automatically loads and shows a preview timeline while AI is disabled, with no button click', async () => {
    mockAiTagSuggestionsEnabled = false
    mockGetThrowbackPreview.mockResolvedValue([
      { year: 2020, filePath: '/a.jpg' },
      { year: 2021, filePath: '/b.jpg' }
    ])
    renderWidget()

    expect(await screen.findByText('2020')).toBeInTheDocument()
    expect(screen.getByText('Preview')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Preview Time Warp' })).not.toBeInTheDocument()
  })

  it('caps the automatic preview at 3 entries', async () => {
    mockAiTagSuggestionsEnabled = false
    mockGetThrowbackPreview.mockResolvedValue([
      { year: 2018, filePath: '/a.jpg' },
      { year: 2019, filePath: '/b.jpg' },
      { year: 2020, filePath: '/c.jpg' },
      { year: 2021, filePath: '/d.jpg' },
      { year: 2022, filePath: '/e.jpg' }
    ])
    renderWidget()

    await screen.findByText('Preview')
    expect(screen.getByText('2018')).toBeInTheDocument()
    expect(screen.getByText('2019')).toBeInTheDocument()
    expect(screen.getByText('2020')).toBeInTheDocument()
    expect(screen.queryByText('2021')).not.toBeInTheDocument()
    expect(screen.queryByText('2022')).not.toBeInTheDocument()
  })

  it('shows no preview section when there is not enough data to preview', async () => {
    mockAiTagSuggestionsEnabled = false
    mockGetThrowbackPreview.mockResolvedValue(null)
    renderWidget()

    await screen.findByRole('button', { name: 'Enable AI Features' })
    expect(screen.queryByText('Preview')).not.toBeInTheDocument()
  })

  it('does not show "Enable AI Features" once AI is already enabled', async () => {
    mockAiTagSuggestionsEnabled = true
    mockGetThrowbackSimilarity.mockResolvedValue(null)
    renderWidget()

    await screen.findByText('No cross-year matches found yet.')
    expect(screen.queryByRole('button', { name: 'Enable AI Features' })).not.toBeInTheDocument()
  })

  it('shows an automatic preview when AI is enabled but no cross-year matches were found', async () => {
    mockAiTagSuggestionsEnabled = true
    mockGetThrowbackSimilarity.mockResolvedValue(null)
    mockGetThrowbackPreview.mockResolvedValue([{ year: 2020, filePath: '/a.jpg' }])
    renderWidget()

    await screen.findByText('No cross-year matches found yet.')
    expect(await screen.findByText('Preview')).toBeInTheDocument()
    expect(screen.getByText('2020')).toBeInTheDocument()
  })

  it('does not fetch a preview once a real timeline is showing', async () => {
    mockAiTagSuggestionsEnabled = true
    mockGetThrowbackSimilarity.mockResolvedValue([{ year: 2020, filePath: '/a.jpg' }])
    renderWidget()

    await screen.findByText('2020')
    expect(mockGetThrowbackPreview).not.toHaveBeenCalled()
  })

  it('refetches once a scan finishes, replacing the loading state with the new timeline', async () => {
    mockAiTagSuggestionsEnabled = true
    mockGetThrowbackSimilarity.mockResolvedValueOnce(null)
    mockAiScanProgress = { phase: 'embedding', done: 1, total: 2 }
    const { rerender } = renderWidget()

    await screen.findByText('No cross-year matches found yet.')

    mockGetThrowbackSimilarity.mockResolvedValueOnce([
      { year: 2020, filePath: '/a.jpg' },
      { year: 2021, filePath: '/b.jpg' }
    ])
    mockAiScanProgress = null
    rerender(
      <MantineProvider>
        <TimeWarpWidget />
      </MantineProvider>
    )

    expect(await screen.findByText('2020')).toBeInTheDocument()
  })
})
