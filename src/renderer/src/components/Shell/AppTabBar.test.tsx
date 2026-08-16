import { MantineProvider, Tabs } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OpenTabEntry } from '@renderer/state/PhotoLibraryContext'

const mockClosePhotoTab = vi.fn()
const mockCloseAllTabs = vi.fn()
const mockSetDetailsPanelCollapsed = vi.fn()
const mockReorderPhotoTabs = vi.fn()

let mockActiveTab = 'gallery'
let mockOpenTabs: string[] = []
let mockOpenTabEntries: OpenTabEntry[] = []
let mockCompareTabs = new Set<string>()
let mockDetailsPanelCollapsed = false

vi.mock('@renderer/state/PhotoLibraryGalleryContext', () => ({
  useGalleryLibrary: () => ({
    state: {
      activeTab: mockActiveTab,
      openTabs: mockOpenTabs,
      compareTabs: mockCompareTabs,
      detailsPanelCollapsed: mockDetailsPanelCollapsed
    },
    openTabEntries: mockOpenTabEntries
  })
}))
vi.mock('@renderer/state/PhotoLibraryActionsContext', () => ({
  useLibraryActions: () => ({
    closePhotoTab: mockClosePhotoTab,
    closeAllTabs: mockCloseAllTabs,
    setDetailsPanelCollapsed: mockSetDetailsPanelCollapsed,
    reorderPhotoTabs: mockReorderPhotoTabs
  })
}))

// Neither of these has any bearing on AppTabBar's own logic under test — each pulls in its own
// usePhotoLibrary() requirements, so both are stubbed, matching this codebase's convention.
vi.mock('@components', () => ({
  CompareTabLabel: () => <div>CompareTabLabel</div>,
  ScanProgressBar: () => <div>ScanProgressBar</div>,
  SettingsModal: () => <div>SettingsModal</div>,
  SortableTab: (props: { value: string; children?: React.ReactNode }) => (
    <Tabs.Tab value={props.value}>{props.children}</Tabs.Tab>
  ),
  TabLabel: ({ fileName }: { fileName: string }) => <div>{fileName}</div>
}))

import { AppTabBar } from './AppTabBar'

function renderTabBar(): void {
  render(
    <MantineProvider>
      <Tabs value={mockActiveTab} onChange={() => {}}>
        <AppTabBar />
      </Tabs>
    </MantineProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockActiveTab = 'gallery'
  mockOpenTabs = []
  mockOpenTabEntries = []
  mockCompareTabs = new Set()
  mockDetailsPanelCollapsed = false
})

describe('AppTabBar', () => {
  it('renders the Dashboard and Gallery tabs plus any open photo tabs', () => {
    mockOpenTabs = ['/a.jpg']
    mockOpenTabEntries = [{ kind: 'photo', id: '/a.jpg', photo: { fileName: 'a.jpg' } } as never]
    renderTabBar()

    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Gallery' })).toBeInTheDocument()
    expect(screen.getByText('a.jpg')).toBeInTheDocument()
  })

  it('does not show the close-all button when no tabs are open', () => {
    mockOpenTabs = []
    renderTabBar()
    expect(screen.queryByLabelText('Close all tabs')).not.toBeInTheDocument()
  })

  it('shows and wires up the close-all button when tabs are open', async () => {
    mockOpenTabs = ['/a.jpg']
    mockOpenTabEntries = [{ kind: 'photo', id: '/a.jpg', photo: { fileName: 'a.jpg' } } as never]
    const user = userEvent.setup()
    renderTabBar()

    await user.click(screen.getByLabelText('Close all tabs'))
    expect(mockCloseAllTabs).toHaveBeenCalled()
  })

  it('toggles the details panel', async () => {
    const user = userEvent.setup()
    renderTabBar()

    await user.click(screen.getByLabelText('Toggle details panel'))
    expect(mockSetDetailsPanelCollapsed).toHaveBeenCalledWith(true)
  })

  it('hides the details-panel toggle while on the Dashboard tab', () => {
    mockActiveTab = 'dashboard'
    renderTabBar()
    expect(screen.queryByLabelText('Toggle details panel')).not.toBeInTheDocument()
  })

  it('hides the details-panel toggle for an active compare tab', () => {
    mockActiveTab = 'compare-1'
    mockCompareTabs = new Set(['compare-1'])
    renderTabBar()
    expect(screen.queryByLabelText('Toggle details panel')).not.toBeInTheDocument()
  })

  it('renders ScanProgressBar and SettingsModal', () => {
    renderTabBar()
    expect(screen.getByText('ScanProgressBar')).toBeInTheDocument()
    expect(screen.getByText('SettingsModal')).toBeInTheDocument()
  })
})
