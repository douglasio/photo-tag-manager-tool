import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SearchResult, SemanticSearchResult } from '@shared/types'

const {
  mockClose,
  mockSelectPhoto,
  mockOpenPhotoTab,
  mockSetFolderFilter,
  mockSetFolderTagFilter,
  mockSetPersonFilter,
  mockSetSearchResults,
  mockSearchPhotos,
  mockSemanticSearchPhotos,
  mockScanProgress
} = vi.hoisted(() => ({
  mockClose: vi.fn(),
  mockSelectPhoto: vi.fn(),
  mockOpenPhotoTab: vi.fn(),
  mockSetFolderFilter: vi.fn(),
  mockSetFolderTagFilter: vi.fn(),
  mockSetPersonFilter: vi.fn(),
  mockSetSearchResults: vi.fn(),
  mockSearchPhotos: vi.fn(),
  mockSemanticSearchPhotos: vi.fn(),
  // Mutable wrapper (not a vi.fn()) — tests reassign .embeddingIndexProgress
  // before rendering to control what useScanProgress() returns.
  mockScanProgress: { embeddingIndexProgress: null as { done: number; total: number } | null }
}))

// Stands in for Mantine's Spotlight so the modal renders inline, without the
// portal/overlay machinery. Root owns the query input (the real Spotlight
// wires Spotlight.Search to Root's controlled query), which keeps the text
// box driving the real parser rather than a stubbed one.
vi.mock('@mantine/spotlight', () => ({
  spotlight: { open: vi.fn(), close: mockClose },
  Spotlight: {
    Root: ({
      query,
      onQueryChange,
      children
    }: {
      query: string
      onQueryChange: (value: string) => void
      children: React.ReactNode
    }) => (
      <div>
        <input
          aria-label="Search input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {children}
      </div>
    ),
    Search: () => null,
    ActionsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ActionsGroup: ({ label, children }: { label: string; children: React.ReactNode }) => (
      <div>
        <div>{label}</div>
        {children}
      </div>
    ),
    // Real Spotlight.Root defaults closeOnActionTrigger to true, so every
    // Action closes the spotlight on click unless it opts out — mirrored
    // here so a component that forgets closeSpotlightOnTrigger={false} on a
    // non-closing action (e.g. "View all", "Back") fails a test instead of
    // only failing in the real app.
    Action: ({
      label,
      children,
      onClick,
      closeSpotlightOnTrigger = true,
      ...rest
    }: {
      label?: string
      children?: React.ReactNode
      onClick?: () => void
      closeSpotlightOnTrigger?: boolean
    } & Record<string, unknown>) => (
      <button
        onClick={() => {
          onClick?.()
          if (closeSpotlightOnTrigger) mockClose()
        }}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children ?? label}
      </button>
    ),
    Empty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  }
}))

vi.mock('@renderer/state/PhotoLibraryActionsContext', () => ({
  useLibraryActions: () => ({
    selectPhoto: mockSelectPhoto,
    openPhotoTab: mockOpenPhotoTab,
    setFolderFilter: mockSetFolderFilter,
    setFolderTagFilter: mockSetFolderTagFilter,
    setPersonFilter: mockSetPersonFilter,
    setSearchResults: mockSetSearchResults
  })
}))

vi.mock('@renderer/state/PhotoLibrarySidebarContext', () => ({
  useSidebarLibrary: () => ({
    allTags: ['beach', 'beachfront', 'winter'],
    state: {
      people: [{ id: 'p1', name: 'Joe Beach', faceCount: 4 }],
      // Watched root plus a subfolder — folder results must cover both.
      allFolderPaths: new Set(['/photos', '/photos/beach-trip', '/photos/winter'])
    }
  })
}))

vi.mock('@renderer/state/PhotoLibraryScanProgressContext', () => ({
  useScanProgress: () => mockScanProgress
}))

import { SearchSpotlight } from './SearchSpotlight'

function makeResult(paths: string[], total = paths.length): SearchResult {
  return {
    hits: paths.map((filePath) => ({
      filePath,
      fileName: filePath.split('/').pop() ?? filePath,
      score: 1,
      thumbnailKey: null
    })),
    total,
    paths
  }
}

function makeSemanticResult(paths: string[]): SemanticSearchResult {
  return {
    hits: paths.map((filePath) => ({
      filePath,
      fileName: filePath.split('/').pop() ?? filePath,
      score: 0.3,
      thumbnailKey: null
    })),
    indexedCount: paths.length,
    totalReadyCount: paths.length
  }
}

function renderSpotlight(): void {
  render(
    // env="test" makes Mantine's Transition (used for the row/expanded-list
    // slide animation) render synchronously instead of through its real
    // timer-driven animation state machine, which fake timers can't drive.
    <MantineProvider env="test">
      <SearchSpotlight />
    </MantineProvider>
  )
}

// Types into the search box and drains the debounce plus the IPC promise.
async function search(text: string): Promise<void> {
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Search input'), { target: { value: text } })
  })
  await act(async () => {
    vi.advanceTimersByTime(200)
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mockSearchPhotos.mockResolvedValue(makeResult([]))
  mockSemanticSearchPhotos.mockResolvedValue(makeSemanticResult([]))
  // @ts-expect-error - partial window.api stub; only these two are exercised
  window.api = { searchPhotos: mockSearchPhotos, semanticSearchPhotos: mockSemanticSearchPhotos }
  mockScanProgress.embeddingIndexProgress = null
})

afterEach(() => {
  vi.useRealTimers()
})

describe('photo results', () => {
  // Regression: this used to call selectPhoto alone, which only moves the
  // highlight — from the Dashboard tab, or with the gallery filtered
  // elsewhere, clicking a result appeared to do nothing at all.
  it('opens the photo in a tab, not just selects it', async () => {
    mockSearchPhotos.mockResolvedValue(makeResult(['/photos/a.jpg']))
    renderSpotlight()
    await search('a.jpg')

    act(() => screen.getByLabelText('a.jpg').click())

    expect(mockOpenPhotoTab).toHaveBeenCalledWith('/photos/a.jpg')
    expect(mockSelectPhoto).toHaveBeenCalledWith('/photos/a.jpg')
    expect(mockClose).toHaveBeenCalled()
  })

  it('shows the full match count in the group label, not the truncated one', async () => {
    mockSearchPhotos.mockResolvedValue(makeResult(['/photos/a.jpg', '/photos/b.jpg'], 57))
    renderSpotlight()
    await search('beach')

    expect(screen.getByText('Photos (57)')).toBeInTheDocument()
  })
})

describe('show all in gallery', () => {
  // Regression: this was gated on total > the modal's 7-row cap, so a search
  // matching a handful of photos had no route to the gallery at all.
  it('is offered even when every result already fits in the modal', async () => {
    mockSearchPhotos.mockResolvedValue(makeResult(['/photos/a.jpg', '/photos/b.jpg']))
    renderSpotlight()
    await search('beach')

    act(() => screen.getByText('Show these results in Gallery').closest('button')!.click())

    expect(mockSetSearchResults).toHaveBeenCalledWith({
      paths: ['/photos/a.jpg', '/photos/b.jpg'],
      label: 'beach'
    })
    expect(mockClose).toHaveBeenCalled()
  })

  it('hands over every matched path, not just the ones the row rendered', async () => {
    const paths = Array.from({ length: 20 }, (_, index) => `/photos/${index}.jpg`)
    mockSearchPhotos.mockResolvedValue(makeResult(paths))
    renderSpotlight()
    await search('beach')

    // Beyond the 7-thumbnail row, the gallery action only appears after
    // expanding to the full list via "View all" — which renders every hit,
    // so the expanded view's own count matches the total exactly. Both
    // buttons split their number into a <strong>, so getByRole (which
    // flattens descendant text into the accessible name) is used instead of
    // getByText (which only matches a single text node).
    act(() => screen.getByRole('button', { name: 'View all 20' }).click())
    act(() => screen.getByRole('button', { name: 'Show 20 results in gallery' }).click())

    expect(mockSetSearchResults.mock.calls[0][0].paths).toHaveLength(20)
  })

  // Regression: Spotlight.Root defaults closeOnActionTrigger to true, so
  // without closeSpotlightOnTrigger={false} on the "View all" action, Mantine
  // closed the whole dropdown right after the click — the row never expanded
  // and clicking looked like it did nothing at all.
  it('expands the row in place instead of closing the dropdown', async () => {
    const paths = Array.from({ length: 20 }, (_, index) => `/photos/${index}.jpg`)
    mockSearchPhotos.mockResolvedValue(makeResult(paths))
    renderSpotlight()
    await search('beach')

    act(() => screen.getByRole('button', { name: 'View all 20' }).click())

    expect(mockClose).not.toHaveBeenCalled()
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getByLabelText('19.jpg')).toBeInTheDocument()

    act(() => screen.getByText('Back').closest('button')!.click())

    expect(mockClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'View all 20' })).toBeInTheDocument()
  })
})

describe('entity results', () => {
  it('filters by tag and closes', async () => {
    renderSpotlight()
    await search('beachfront')

    act(() => screen.getByText('beachfront').closest('button')!.click())

    expect(mockSetFolderTagFilter).toHaveBeenCalledWith('beachfront')
    expect(mockClose).toHaveBeenCalled()
  })

  it('filters by person and closes', async () => {
    renderSpotlight()
    await search('joe')

    act(() => screen.getByText('Joe Beach').closest('button')!.click())

    expect(mockSetPersonFilter).toHaveBeenCalledWith('p1')
  })

  // Regression: this read state.folders (watched roots only), so subfolders —
  // where people actually navigate — never appeared.
  it('offers subfolders, not just watched roots', async () => {
    renderSpotlight()
    await search('beach-trip')

    act(() => screen.getByText('/photos/beach-trip').closest('button')!.click())

    expect(mockSetFolderFilter).toHaveBeenCalledWith('/photos/beach-trip')
  })
})

describe('facet chips', () => {
  it('writes the facet into the query text, so chips and typing stay one source of truth', async () => {
    renderSpotlight()
    await search('beach')

    await act(async () => {
      screen.getByText('untagged').click()
    })

    expect(screen.getByLabelText('Search input')).toHaveValue('beach is:untagged')
  })

  it('toggles the facet back off, removing it from the text', async () => {
    renderSpotlight()
    await search('beach is:untagged')

    await act(async () => {
      screen.getByText('untagged').click()
    })

    expect(screen.getByLabelText('Search input')).toHaveValue('beach')
  })

  it('re-queries with the exclusion override when that chip is toggled', async () => {
    renderSpotlight()
    await search('beach')
    expect(mockSearchPhotos.mock.calls[0][0].includeExcluded).toBe(false)

    await act(async () => {
      screen.getByText('excluded folders').click()
    })
    await act(async () => {
      vi.advanceTimersByTime(200)
      await Promise.resolve()
      await Promise.resolve()
    })

    const last = mockSearchPhotos.mock.calls.at(-1)![0]
    expect(last.includeExcluded).toBe(true)
  })
})

describe('visual matches', () => {
  it('opens a semantic hit the same way an exact hit opens, mixed into Photos', async () => {
    mockSemanticSearchPhotos.mockResolvedValue(makeSemanticResult(['/photos/sunset.jpg']))
    renderSpotlight()
    await search('beach')

    // No separate section — the semantic hit renders inline under Photos.
    expect(screen.getByText('Photos (1)')).toBeInTheDocument()
    act(() => screen.getByLabelText('sunset.jpg').click())

    expect(mockOpenPhotoTab).toHaveBeenCalledWith('/photos/sunset.jpg')
    expect(mockClose).toHaveBeenCalled()
  })

  // A photo already found by the exact scan isn't a distinct visual finding
  // — it should only ever appear once.
  it('excludes a photo already present in the exact facet matches', async () => {
    mockSearchPhotos.mockResolvedValue(makeResult(['/photos/a.jpg']))
    mockSemanticSearchPhotos.mockResolvedValue(
      makeSemanticResult(['/photos/a.jpg', '/photos/b.jpg'])
    )
    renderSpotlight()
    await search('beach')

    // 1 exact + 1 distinct semantic hit, not 1 exact + 2 semantic.
    expect(screen.getByText('Photos (2)')).toBeInTheDocument()
    expect(screen.getByLabelText('b.jpg')).toBeInTheDocument()
    expect(screen.queryAllByLabelText('a.jpg')).toHaveLength(1)
  })

  it('folds semantic-only paths into the single gallery action', async () => {
    mockSearchPhotos.mockResolvedValue(makeResult(['/photos/a.jpg']))
    mockSemanticSearchPhotos.mockResolvedValue(makeSemanticResult(['/photos/b.jpg']))
    renderSpotlight()
    await search('beach')

    act(() => screen.getByText('Show these results in Gallery').closest('button')!.click())

    expect(mockSetSearchResults).toHaveBeenCalledWith({
      paths: ['/photos/a.jpg', '/photos/b.jpg'],
      label: 'beach'
    })
  })

  it('drops semantic hits from the list and the gallery action when the chip is off', async () => {
    mockSearchPhotos.mockResolvedValue(makeResult(['/photos/a.jpg']))
    mockSemanticSearchPhotos.mockResolvedValue(makeSemanticResult(['/photos/b.jpg']))
    renderSpotlight()
    await search('beach')

    expect(screen.getByText('Photos (2)')).toBeInTheDocument()

    act(() => screen.getByText('visual matches').click())

    expect(screen.getByText('Photos (1)')).toBeInTheDocument()
    expect(screen.queryByLabelText('b.jpg')).not.toBeInTheDocument()

    act(() => screen.getByText('Show these results in Gallery').closest('button')!.click())
    expect(mockSetSearchResults).toHaveBeenCalledWith({
      paths: ['/photos/a.jpg'],
      label: 'beach'
    })
  })

  it('never queries semantic search for a flags-only query', async () => {
    renderSpotlight()
    await search('tag:beach person:joe')

    expect(mockSemanticSearchPhotos).not.toHaveBeenCalled()
  })
})

describe('embedding index status', () => {
  function makeSemanticResultWithGap(
    paths: string[],
    indexedCount: number,
    totalReadyCount: number
  ): SemanticSearchResult {
    return { ...makeSemanticResult(paths), indexedCount, totalReadyCount }
  }

  it('shows the static shortfall line when idle', async () => {
    mockSearchPhotos.mockResolvedValue(makeResult(['/photos/a.jpg']))
    mockSemanticSearchPhotos.mockResolvedValue(makeSemanticResultWithGap([], 3, 5))
    renderSpotlight()
    await search('beach')

    expect(screen.getByText('2 photos not yet indexed for visual search')).toBeInTheDocument()
  })

  // Regression: the shortfall count used to just sit there — nothing in the
  // dropdown showed the background indexer was actually draining it.
  it('shows a live count instead once the background indexer is running', async () => {
    mockSearchPhotos.mockResolvedValue(makeResult(['/photos/a.jpg']))
    mockSemanticSearchPhotos.mockResolvedValue(makeSemanticResultWithGap([], 3, 5))
    mockScanProgress.embeddingIndexProgress = { done: 4, total: 10 }
    renderSpotlight()
    await search('beach')

    expect(screen.getByText('Indexing for visual search… 4 of 10')).toBeInTheDocument()
    expect(screen.queryByText(/not yet indexed/)).not.toBeInTheDocument()
  })

  it('hides the line entirely once nothing is unindexed and the indexer is idle', async () => {
    mockSearchPhotos.mockResolvedValue(makeResult(['/photos/a.jpg']))
    mockSemanticSearchPhotos.mockResolvedValue(makeSemanticResultWithGap([], 5, 5))
    renderSpotlight()
    await search('beach')

    expect(screen.queryByText(/not yet indexed/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Indexing for visual search/)).not.toBeInTheDocument()
  })
})

describe('empty states', () => {
  it('teaches the flag syntax before anything is typed', () => {
    renderSpotlight()
    expect(screen.getByText(/Try tag:beach or person:joe before:2020/)).toBeInTheDocument()
  })

  it('says nothing found once a query returns no matches', async () => {
    renderSpotlight()
    await search('zzzznope')

    expect(screen.getByText('Nothing found.')).toBeInTheDocument()
  })

  it('never queries the main process for a whitespace-only query', async () => {
    renderSpotlight()
    await search('   ')

    expect(mockSearchPhotos).not.toHaveBeenCalled()
  })
})
