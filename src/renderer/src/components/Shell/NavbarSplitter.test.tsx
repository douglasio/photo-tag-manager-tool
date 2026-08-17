import { AppShell, MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockFaceDetectionEnabled = false
let mockNavbarCollapsedPanels: Record<string, boolean> = {}

vi.mock('@renderer/state/PhotoLibrarySidebarContext', () => ({
  useSidebarLibrary: () => ({
    state: {
      faceDetectionEnabled: mockFaceDetectionEnabled,
      navbarSplitSizes: [],
      navbarCollapsedPanels: mockNavbarCollapsedPanels
    }
  })
}))
vi.mock('@renderer/state/PhotoLibraryActionsContext', () => ({
  useLibraryActions: () => ({
    setNavbarSplitSizes: vi.fn(),
    setNavbarCollapsedPanels: vi.fn()
  })
}))

// None of these panels' own behavior is relevant here — NavbarSplitter's job under test is which
// panes it renders — so each is stubbed to a trivial placeholder, matching this codebase's convention.
vi.mock('@components', () => ({
  TagPanel: () => <div>TagPanel</div>,
  PeoplePanel: () => <div>PeoplePanel</div>,
  FolderTree: () => <div>FolderTree</div>,
  PANEL_HEADER_HEIGHT: 32
}))

import { NavbarSplitter } from './NavbarSplitter'

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
  mockFaceDetectionEnabled = false
  mockNavbarCollapsedPanels = {}
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
