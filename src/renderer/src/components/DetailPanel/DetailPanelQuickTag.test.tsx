import { MantineProvider } from '@mantine/core'
import type { DisplayPhotoRecord } from '@state'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toDisplayMetadata } from '@utils'

let mockAllTags: string[]
let mockAiTagSuggestionsEnabled: boolean
const mockUpdateTags = vi.fn()
const mockSuggestTags = vi.fn()

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    allTags: mockAllTags,
    updateTags: mockUpdateTags,
    state: {
      aiTagSuggestionsEnabled: mockAiTagSuggestionsEnabled,
      tagDescriptions: new Map()
    },
    suggestTags: mockSuggestTags,
    tagCounts: new Map(),
    tagCoverPhotos: new Map(),
    tagViewCounts: new Map()
  }),
  // TagHoverCardTarget (rendered inside the tag chips here) reads this
  // context directly rather than through usePhotoLibrary.
  useSidebarLibrary: () => ({
    state: { tagDescriptions: new Map() },
    tagCounts: new Map(),
    tagCoverPhotos: new Map(),
    tagViewCounts: new Map()
  })
}))

import { DetailPanelQuickTag } from './DetailPanelQuickTag'

function makePhoto(tags: string[]): DisplayPhotoRecord {
  return {
    id: '/a.jpg',
    filePath: '/a.jpg',
    fileName: 'a.jpg',
    tags,
    metadata: toDisplayMetadata({
      dateTaken: null,
      cameraMake: null,
      cameraModel: null,
      widthPx: null,
      heightPx: null,
      fileSizeBytes: 0,
      format: 'JPEG',
      comment: null
    }),
    thumbnailStatus: 'ready',
    thumbnailKey: 'key',
    scanError: null,
    fromCache: false,
    viewCount: 0
  }
}

function renderQuickTag(tags: string[], onClose = vi.fn()): { onClose: typeof onClose } {
  render(
    <MantineProvider>
      <DetailPanelQuickTag photo={makePhoto(tags)} onClose={onClose} />
    </MantineProvider>
  )
  return { onClose }
}

describe('DetailPanelQuickTag', () => {
  beforeEach(() => {
    mockUpdateTags.mockClear()
    mockSuggestTags.mockClear()
    mockSuggestTags.mockResolvedValue([])
    mockAiTagSuggestionsEnabled = false
  })

  it('shows every known tag as a chip, pre-checking ones already on the photo', () => {
    mockAllTags = ['vacation', 'family', 'work']
    renderQuickTag(['vacation'])

    expect(screen.getByRole('checkbox', { name: 'vacation' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'family' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'work' })).not.toBeChecked()
  })

  it('adds a tag instantly when its chip is checked', async () => {
    mockAllTags = ['vacation', 'family']
    const user = userEvent.setup()
    renderQuickTag(['vacation'])

    await user.click(screen.getByRole('checkbox', { name: 'family' }))

    expect(mockUpdateTags).toHaveBeenCalledExactlyOnceWith('/a.jpg', ['vacation', 'family'])
  })

  it('removes a tag instantly when its chip is unchecked', async () => {
    mockAllTags = ['vacation', 'family']
    const user = userEvent.setup()
    renderQuickTag(['vacation', 'family'])

    await user.click(screen.getByRole('checkbox', { name: 'vacation' }))

    expect(mockUpdateTags).toHaveBeenCalledExactlyOnceWith('/a.jpg', ['family'])
  })

  it('shows an empty-state message when no tags exist yet', () => {
    mockAllTags = []
    renderQuickTag([])

    expect(screen.getByText('No tags yet — add one from the Tags panel first.')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    mockAllTags = ['vacation']
    const user = userEvent.setup()
    const { onClose } = renderQuickTag([])

    await user.click(screen.getByRole('button', { name: 'Close quick tag' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not request suggestions when AI tag suggestions are disabled', () => {
    mockAiTagSuggestionsEnabled = false
    mockAllTags = ['vacation']
    renderQuickTag(['vacation'])

    expect(mockSuggestTags).not.toHaveBeenCalled()
  })

  it('requests and renders suggestions, excluding already-applied tags', async () => {
    mockAiTagSuggestionsEnabled = true
    mockAllTags = ['vacation', 'family', 'work']
    mockSuggestTags.mockResolvedValue([
      { tag: 'vacation', score: 0.9 },
      { tag: 'work', score: 0.4 }
    ])
    renderQuickTag(['vacation'])

    expect(mockSuggestTags).toHaveBeenCalledExactlyOnceWith('/a.jpg', [
      'vacation',
      'family',
      'work'
    ])
    await waitFor(() => expect(screen.getByText('+ work')).toBeInTheDocument())
    // "vacation" is already applied, so it's excluded from the suggested row
    // even though the mock returned it as a suggestion.
    expect(screen.queryByText('+ vacation')).not.toBeInTheDocument()
  })

  it('adds a suggested tag when its badge is clicked', async () => {
    mockAiTagSuggestionsEnabled = true
    mockAllTags = ['vacation', 'work']
    mockSuggestTags.mockResolvedValue([{ tag: 'work', score: 0.8 }])
    const user = userEvent.setup()
    renderQuickTag(['vacation'])

    const badge = await screen.findByText('+ work')
    await user.click(badge)

    expect(mockUpdateTags).toHaveBeenCalledExactlyOnceWith('/a.jpg', ['vacation', 'work'])
  })
})
