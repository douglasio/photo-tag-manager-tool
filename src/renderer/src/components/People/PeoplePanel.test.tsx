import { DndContext } from '@dnd-kit/core'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FaceScanResult, PersonRecord } from '@shared/types'

const mockSetPersonFilter = vi.fn()
const mockRenamePerson = vi.fn()
const mockHidePerson = vi.fn()
const mockDeletePerson = vi.fn()
const mockEnableFaceDetection = vi.fn()
const mockRescanFaces = vi.fn()

function makePerson(overrides: Partial<PersonRecord> = {}): PersonRecord {
  return {
    id: 'p1',
    name: 'Jamie',
    coverFaceId: 'f1',
    coverPhotoPath: '/a.jpg',
    coverFaceBox: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
    faceCount: 2,
    description: null,
    ...overrides
  }
}

const SCAN_RESULT: FaceScanResult = {
  facesDetected: 0,
  peopleCount: 0,
  photosScanned: 0,
  canceled: false
}

let mockState: {
  people: PersonRecord[]
  selectedPerson: string | null
  peoplePanelGridView: boolean
  faceDetectionEnabled: boolean
  faceScanInProgress: boolean
}

vi.mock('@state', () => ({
  useSidebarLibrary: () => ({
    state: mockState,
    personCoverPhotos: new Map()
  }),
  useLibraryActions: () => ({
    setPersonFilter: mockSetPersonFilter,
    renamePerson: mockRenamePerson,
    hidePerson: mockHidePerson,
    deletePerson: mockDeletePerson,
    enableFaceDetection: mockEnableFaceDetection,
    rescanFaces: mockRescanFaces
  })
}))

import { PeoplePanel } from './PeoplePanel'

function renderPanel(): void {
  render(
    <MantineProvider>
      <DndContext onDragEnd={() => {}}>
        <PeoplePanel />
      </DndContext>
    </MantineProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRenamePerson.mockResolvedValue(undefined)
  mockHidePerson.mockResolvedValue(undefined)
  mockDeletePerson.mockResolvedValue(undefined)
  mockEnableFaceDetection.mockResolvedValue(SCAN_RESULT)
  mockRescanFaces.mockResolvedValue(SCAN_RESULT)
  mockState = {
    people: [makePerson()],
    selectedPerson: null,
    peoplePanelGridView: false,
    faceDetectionEnabled: true,
    faceScanInProgress: false
  }
})

describe('PeoplePanel', () => {
  it('renders a row per person with name and face count', () => {
    mockState.people = [
      makePerson({ id: 'p1', name: 'Jamie', faceCount: 2 }),
      makePerson({ id: 'p2', name: 'Alex', faceCount: 5 })
    ]
    renderPanel()

    expect(screen.getByText('Jamie')).toBeInTheDocument()
    expect(screen.getByText('Alex')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('filters by a person when its row is clicked', () => {
    renderPanel()

    // fireEvent, not userEvent — the row is a dnd-kit draggable, and
    // userEvent's fuller pointer-event sequence gets intercepted by its
    // PointerSensor before the click ever fires (verified: real drag
    // gestures still work in the app; this is a jsdom/testing-only quirk).
    fireEvent.click(screen.getByText('Jamie'))

    expect(mockSetPersonFilter).toHaveBeenCalledExactlyOnceWith('p1')
  })

  it('clears the filter when clicking the already-active person', () => {
    mockState.selectedPerson = 'p1'
    renderPanel()

    fireEvent.click(screen.getByText('Jamie'))

    expect(mockSetPersonFilter).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('renames a person via the pencil icon', async () => {
    const user = userEvent.setup()
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Rename Jamie' }))
    const input = screen.getByPlaceholderText('Unnamed person')
    await user.clear(input)
    await user.type(input, 'Jamie Smith{Enter}')

    expect(mockRenamePerson).toHaveBeenCalledExactlyOnceWith('p1', 'Jamie Smith')
  })

  it('hides a person via the context menu, after confirming', async () => {
    const user = userEvent.setup()
    renderPanel()

    fireEvent.contextMenu(screen.getByText('Jamie'))
    await user.click(await screen.findByText('Hide'))

    expect(mockHidePerson).not.toHaveBeenCalled()
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Hide' }))

    expect(mockHidePerson).toHaveBeenCalledExactlyOnceWith('p1')
  })

  it('deletes a person via the context menu, after confirming', async () => {
    const user = userEvent.setup()
    renderPanel()

    fireEvent.contextMenu(screen.getByText('Jamie'))
    await user.click(await screen.findByText('Delete'))

    expect(mockDeletePerson).not.toHaveBeenCalled()
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    expect(mockDeletePerson).toHaveBeenCalledExactlyOnceWith('p1')
  })

  it('renders grid tiles instead of rows when grid view is on', () => {
    mockState.peoplePanelGridView = true
    renderPanel()

    expect(screen.getByText('Jamie')).toBeInTheDocument()
    expect(screen.getByText('2 faces')).toBeInTheDocument()
  })

  describe('empty state', () => {
    it('shows a scan button that enables face detection when not yet enabled', async () => {
      mockState.people = []
      mockState.faceDetectionEnabled = false
      const user = userEvent.setup()
      renderPanel()

      expect(screen.getByText('No people yet.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Scan for faces' }))

      expect(mockEnableFaceDetection).toHaveBeenCalledOnce()
      expect(mockRescanFaces).not.toHaveBeenCalled()
    })

    it('re-scans instead of re-enabling when face detection is already on', async () => {
      mockState.people = []
      mockState.faceDetectionEnabled = true
      const user = userEvent.setup()
      renderPanel()

      await user.click(screen.getByRole('button', { name: 'Scan for faces' }))

      expect(mockRescanFaces).toHaveBeenCalledOnce()
      expect(mockEnableFaceDetection).not.toHaveBeenCalled()
    })

    it('shows an error message if the scan fails to start', async () => {
      mockState.people = []
      mockState.faceDetectionEnabled = false
      mockEnableFaceDetection.mockRejectedValueOnce(new Error('boom'))
      const user = userEvent.setup()
      renderPanel()

      await user.click(screen.getByRole('button', { name: 'Scan for faces' }))

      expect(await screen.findByText('Failed to scan your library for faces.')).toBeInTheDocument()
    })

    it('disables the button while a scan is running, even one started elsewhere', () => {
      mockState.people = []
      mockState.faceScanInProgress = true
      renderPanel()

      expect(screen.getByRole('button', { name: 'Scan for faces' })).toBeDisabled()
    })
  })
})
