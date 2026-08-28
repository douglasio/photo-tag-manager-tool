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
  mockSemanticSearchPhotos
} = vi.hoisted(() => ({
  mockClose: vi.fn(),
  mockSelectPhoto: vi.fn(),
  mockOpenPhotoTab: vi.fn(),
  mockSetFolderFilter: vi.fn(),
  mockSetFolderTagFilter: vi.fn(),
  mockSetPersonFilter: vi.fn(),
  mockSetSearchResults: vi.fn(),
  mockSearchPhotos: vi.fn(),
  mockSemanticSearchPhotos: vi.fn()
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
    Action: ({
      label,
      children,
      onClick
    }: {
      label?: string
      children?: React.ReactNode
      onClick?: () => void
    }) => <button onClick={onClick}>{children ?? label}</button>,
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
    <MantineProvider>
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

    act(() => screen.getByText('a.jpg').closest('button')!.click())

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

  it('hands over every matched path, not just the ones the modal rendered', async () => {
    const paths = Array.from({ length: 20 }, (_, index) => `/photos/${index}.jpg`)
    mockSearchPhotos.mockResolvedValue(makeResult(paths))
    renderSpotlight()
    await search('beach')

    act(() => screen.getByText('Show all 20 results in Gallery').closest('button')!.click())

    expect(mockSetSearchResults.mock.calls[0][0].paths).toHaveLength(20)
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
      screen.getByText('Untagged').click()
    })

    expect(screen.getByLabelText('Search input')).toHaveValue('beach is:untagged')
  })

  it('toggles the facet back off, removing it from the text', async () => {
    renderSpotlight()
    await search('beach is:untagged')

    await act(async () => {
      screen.getByText('Untagged').click()
    })

    expect(screen.getByLabelText('Search input')).toHaveValue('beach')
  })

  it('re-queries with the exclusion override when that chip is toggled', async () => {
    renderSpotlight()
    await search('beach')
    expect(mockSearchPhotos.mock.calls[0][0].includeExcluded).toBe(false)

    await act(async () => {
      screen.getByText('Include excluded folders').click()
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
  it('opens a semantic hit the same way an exact hit opens', async () => {
    mockSemanticSearchPhotos.mockResolvedValue(makeSemanticResult(['/photos/sunset.jpg']))
    renderSpotlight()
    await search('beach')

    act(() => screen.getByText('sunset.jpg').closest('button')!.click())

    expect(mockOpenPhotoTab).toHaveBeenCalledWith('/photos/sunset.jpg')
    expect(mockClose).toHaveBeenCalled()
  })

  // A photo already found by the exact scan isn't a distinct visual finding
  // — it should only ever appear once, under Photos.
  it('excludes a photo already present in the exact facet matches', async () => {
    mockSearchPhotos.mockResolvedValue(makeResult(['/photos/a.jpg']))
    mockSemanticSearchPhotos.mockResolvedValue(
      makeSemanticResult(['/photos/a.jpg', '/photos/b.jpg'])
    )
    renderSpotlight()
    await search('beach')

    expect(screen.getByText('Visual matches')).toBeInTheDocument()
    expect(screen.getByText('b.jpg')).toBeInTheDocument()
    expect(screen.queryAllByText('a.jpg')).toHaveLength(1)
  })

  it('appends semantic-only paths after the exact matches in Show all in Gallery', async () => {
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

  it('never queries semantic search for a flags-only query', async () => {
    renderSpotlight()
    await search('tag:beach person:joe')

    expect(mockSemanticSearchPhotos).not.toHaveBeenCalled()
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
