import { AppShell, MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSetActiveTab = vi.fn()
const mockSetNavbarCollapsedPanels = vi.fn()
const mockSetNavbarSplitSizes = vi.fn()

let mockActiveTab = 'gallery'
let mockOpenTabs: string[] = []
let mockFaceDetectionEnabled = false
let mockNavbarCollapsedPanels: Record<string, boolean> = {}

vi.mock('./state/PhotoLibrarySidebarContext', () => ({
  useSidebarLibrary: () => ({
    state: {
      faceDetectionEnabled: mockFaceDetectionEnabled,
      navbarSplitSizes: [],
      navbarCollapsedPanels: mockNavbarCollapsedPanels,
      people: []
    }
  })
}))
vi.mock('./state/PhotoLibraryGalleryContext', () => ({
  useGalleryLibrary: () => ({
    state: {
      activeTab: mockActiveTab,
      openTabs: mockOpenTabs,
      compareTabs: new Set<string>(),
      detailsPanelCollapsed: false,
      photosByPath: new Map()
    },
    openTabEntries: []
  })
}))
vi.mock('./state/PhotoLibraryActionsContext', () => ({
  useLibraryActions: () => ({
    closePhotoTab: vi.fn(),
    closeAllTabs: vi.fn(),
    setActiveTab: mockSetActiveTab,
    addTagsToPhotos: vi.fn(),
    movePhotosToFolder: vi.fn(),
    setDetailsPanelCollapsed: vi.fn(),
    reorderPhotoTabs: vi.fn(),
    assignTagToGroup: vi.fn(),
    assignFaceToPerson: vi.fn(),
    mergePeople: vi.fn(),
    setNavbarSplitSizes: mockSetNavbarSplitSizes,
    setNavbarCollapsedPanels: mockSetNavbarCollapsedPanels
  })
}))
vi.mock('./state/PhotoLibraryContext', () => ({
  PhotoLibraryProvider: ({ children }: { children?: React.ReactNode }) => children
}))

// None of these components' own behavior is relevant here — AppLayout's job
// under test is tab switching, keyboard shortcuts, and the navbar Splitter —
// so each is stubbed to a trivial placeholder, the same pattern as
// DashboardView.test.tsx.
vi.mock('@components', () => ({
  AllPhotosRow: () => <div>AllPhotosRow</div>,
  CompareTabLabel: () => <div>CompareTabLabel</div>,
  CompareView: () => <div>CompareView</div>,
  DashboardView: () => <div>DashboardView</div>,
  DetailPanel: () => <div>DetailPanel</div>,
  DuplicatesView: () => <div>DuplicatesView</div>,
  FolderTree: () => <div>FolderTree</div>,
  GalleryGrid: () => <div>GalleryGrid</div>,
  PANEL_HEADER_HEIGHT: 32,
  PeoplePanel: () => <div>PeoplePanel</div>,
  PersonMergeDialog: () => <div>PersonMergeDialog</div>,
  PhotoView: () => <div>PhotoView</div>,
  ScanProgressBar: () => <div>ScanProgressBar</div>,
  SettingsModal: () => <div>SettingsModal</div>,
  SortableTab: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  StartupLoadingScreen: () => <div>StartupLoadingScreen</div>,
  TabLabel: () => <div>TabLabel</div>,
  TagPanel: () => <div>TagPanel</div>,
  UntaggedRow: () => <div>UntaggedRow</div>
}))

import { AppLayout, NavbarSplitter } from './App'

function renderLayout(): void {
  render(
    <MantineProvider>
      <AppLayout />
    </MantineProvider>
  )
}

function renderSplitter(): void {
  render(
    <MantineProvider>
      <AppShell navbar={{ width: 260, breakpoint: 0 }}>
        <NavbarSplitter />
      </AppShell>
    </MantineProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockActiveTab = 'gallery'
  mockOpenTabs = []
  mockFaceDetectionEnabled = false
  mockNavbarCollapsedPanels = {}
})

describe('AppLayout keyboard shortcuts', () => {
  it('switches to the gallery tab on "g"', async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.keyboard('g')
    expect(mockSetActiveTab).toHaveBeenCalledWith('gallery')
  })

  it('switches to the dashboard tab on "d"', async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.keyboard('d')
    expect(mockSetActiveTab).toHaveBeenCalledWith('dashboard')
  })

  it('does not treat "g"/"d" as shortcuts while focus is in a text input', async () => {
    const user = userEvent.setup()
    renderLayout()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    await user.keyboard('g')

    expect(mockSetActiveTab).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('cycles to the next tab with Alt+ArrowRight', async () => {
    mockActiveTab = 'dashboard'
    const user = userEvent.setup()
    renderLayout()

    await user.keyboard('{Alt>}{ArrowRight}{/Alt}')

    expect(mockSetActiveTab).toHaveBeenCalledWith('gallery')
  })

  it('cycles to the previous tab with Alt+ArrowLeft', async () => {
    mockActiveTab = 'gallery'
    const user = userEvent.setup()
    renderLayout()

    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}')

    expect(mockSetActiveTab).toHaveBeenCalledWith('dashboard')
  })

  it('does not cycle past the last tab', async () => {
    mockActiveTab = 'gallery'
    mockOpenTabs = []
    const user = userEvent.setup()
    renderLayout()

    await user.keyboard('{Alt>}{ArrowRight}{/Alt}')

    expect(mockSetActiveTab).not.toHaveBeenCalled()
  })

  it('dispatches a synthetic Escape keydown on pointerdown, to dismiss floating Mantine elements', () => {
    renderLayout()
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent')

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    const escapeDispatch = dispatchSpy.mock.calls.find(
      ([event]) => event instanceof KeyboardEvent && event.key === 'Escape'
    )
    expect(escapeDispatch).toBeDefined()
    expect((escapeDispatch![0] as KeyboardEvent).isTrusted).toBe(false)
  })
})

describe('NavbarSplitter', () => {
  it('renders TagPanel and FolderTree, but not PeoplePanel, when face detection is disabled', () => {
    mockFaceDetectionEnabled = false
    renderSplitter()
    expect(screen.getByText('TagPanel')).toBeInTheDocument()
    expect(screen.getByText('FolderTree')).toBeInTheDocument()
    expect(screen.queryByText('PeoplePanel')).not.toBeInTheDocument()
  })

  it('also renders PeoplePanel when face detection is enabled', () => {
    mockFaceDetectionEnabled = true
    renderSplitter()
    expect(screen.getByText('PeoplePanel')).toBeInTheDocument()
  })
})
