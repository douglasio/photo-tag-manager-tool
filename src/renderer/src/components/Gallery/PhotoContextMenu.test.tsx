import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FaceRecord, PersonRecord, PhotoRecord } from '@shared/types'

let mockSelectedPaths: Set<string>
let mockSelectedPerson: string | null
let mockPeople: PersonRecord[]
const mockDeletePhotos = vi.fn().mockResolvedValue(undefined)
const mockSelectPhoto = vi.fn()
const mockGetFacesForPhoto = vi.fn<() => Promise<FaceRecord[]>>().mockResolvedValue([])
const mockUnassignFace = vi.fn().mockResolvedValue(undefined)

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    openPhotoTab: vi.fn(),
    allTags: [],
    updateTags: vi.fn(),
    selectPhoto: mockSelectPhoto,
    addTagsToSelection: vi.fn(),
    rotatePhoto: vi.fn(),
    deletePhotos: mockDeletePhotos,
    getFacesForPhoto: mockGetFacesForPhoto,
    unassignFace: mockUnassignFace,
    state: {
      selectedPaths: mockSelectedPaths,
      selectedPerson: mockSelectedPerson,
      people: mockPeople
    }
  })
}))

vi.mock('@components', () => ({
  ConfirmDialog: ({
    title,
    opened,
    onConfirm,
    onCancel,
    children
  }: {
    title: string
    opened: boolean
    onConfirm: () => void
    onCancel: () => void
    children: React.ReactNode
  }) =>
    opened ? (
      <div role="dialog">
        <p>{title}</p>
        {children}
        <button onClick={onConfirm}>Delete</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
}))

import { PhotoContextMenu } from './PhotoContextMenu'

function makePhoto(filePath: string, overrides: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: filePath,
    filePath,
    fileName: filePath.split('/').pop() ?? filePath,
    tags: [],
    metadata: {
      dateTaken: null,
      cameraMake: null,
      cameraModel: null,
      widthPx: null,
      heightPx: null,
      fileSizeBytes: 0,
      format: 'JPEG',
      comment: null
    },
    thumbnailStatus: 'ready',
    thumbnailKey: 'key',
    scanError: null,
    fromCache: false,
    viewCount: 0,
    ...overrides
  }
}

function renderMenu(photo: PhotoRecord): void {
  render(
    <MantineProvider>
      <PhotoContextMenu photo={photo} onRename={vi.fn()}>
        <button type="button">{photo.fileName}</button>
      </PhotoContextMenu>
    </MantineProvider>
  )
}

describe('PhotoContextMenu delete', () => {
  beforeEach(() => {
    mockSelectedPaths = new Set()
    mockSelectedPerson = null
    mockPeople = []
    mockDeletePhotos.mockClear()
    mockGetFacesForPhoto.mockClear()
    mockGetFacesForPhoto.mockResolvedValue([])
    mockUnassignFace.mockClear()
  })

  it('shows a plain "Delete" label outside of a multi-selection', async () => {
    const photo = makePhoto('/root/a.jpg')
    renderMenu(photo)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'a.jpg' }))

    expect(await screen.findByText('Delete')).toBeInTheDocument()
  })

  it('shows a batch label when the photo is part of the active multi-selection', async () => {
    mockSelectedPaths = new Set(['/root/a.jpg', '/root/b.jpg'])
    const photo = makePhoto('/root/a.jpg')
    renderMenu(photo)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'a.jpg' }))

    expect(await screen.findByText('Delete 2 Photos')).toBeInTheDocument()
  })

  it('does not delete until the confirmation dialog is confirmed', async () => {
    const user = userEvent.setup()
    const photo = makePhoto('/root/a.jpg')
    renderMenu(photo)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'a.jpg' }))
    await user.click(await screen.findByText('Delete'))

    expect(mockDeletePhotos).not.toHaveBeenCalled()
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    expect(mockDeletePhotos).toHaveBeenCalledExactlyOnceWith(['/root/a.jpg'])
  })

  it('deletes every selected path when confirmed in batch mode', async () => {
    mockSelectedPaths = new Set(['/root/a.jpg', '/root/b.jpg'])
    const user = userEvent.setup()
    const photo = makePhoto('/root/a.jpg')
    renderMenu(photo)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'a.jpg' }))
    await user.click(await screen.findByText('Delete 2 Photos'))
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    expect(mockDeletePhotos).toHaveBeenCalledExactlyOnceWith(['/root/a.jpg', '/root/b.jpg'])
  })

  it('does not delete when the confirmation dialog is canceled', async () => {
    const user = userEvent.setup()
    const photo = makePhoto('/root/a.jpg')
    renderMenu(photo)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'a.jpg' }))
    await user.click(await screen.findByText('Delete'))
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))

    expect(mockDeletePhotos).not.toHaveBeenCalled()
  })
})

describe('PhotoContextMenu person filter', () => {
  beforeEach(() => {
    mockSelectedPaths = new Set()
    mockSelectedPerson = null
    mockPeople = []
    mockGetFacesForPhoto.mockClear()
    mockGetFacesForPhoto.mockResolvedValue([])
    mockUnassignFace.mockClear()
  })

  function makeFace(overrides: Partial<FaceRecord> = {}): FaceRecord {
    return {
      id: 'face-1',
      photoPath: '/root/a.jpg',
      box: { x: 0, y: 0, w: 1, h: 1 },
      personId: null,
      personIdPinned: false,
      ...overrides
    }
  }

  it('does not show a "Not [person]" item when no person filter is active', async () => {
    const photo = makePhoto('/root/a.jpg')
    renderMenu(photo)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'a.jpg' }))

    expect(await screen.findByText('Delete')).toBeInTheDocument()
    expect(screen.queryByText(/^Not /)).not.toBeInTheDocument()
  })

  it("shows the person's name and unassigns only faces belonging to them", async () => {
    mockSelectedPerson = 'p1'
    mockPeople = [
      { id: 'p1', name: 'Jamie', coverFaceId: null, coverPhotoPath: null, faceCount: 1 }
    ]
    mockGetFacesForPhoto.mockResolvedValue([
      makeFace({ id: 'face-1', personId: 'p1' }),
      makeFace({ id: 'face-2', personId: 'p2' })
    ])
    const user = userEvent.setup()
    const photo = makePhoto('/root/a.jpg')
    renderMenu(photo)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'a.jpg' }))
    await user.click(await screen.findByText('Not Jamie'))

    expect(mockGetFacesForPhoto).toHaveBeenCalledWith('/root/a.jpg')
    expect(mockUnassignFace).toHaveBeenCalledExactlyOnceWith('face-1')
  })

  it('falls back to "this person" for an unnamed person', async () => {
    mockSelectedPerson = 'p1'
    mockPeople = [{ id: 'p1', name: null, coverFaceId: null, coverPhotoPath: null, faceCount: 1 }]
    const photo = makePhoto('/root/a.jpg')
    renderMenu(photo)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'a.jpg' }))

    expect(await screen.findByText('Not this person')).toBeInTheDocument()
  })

  it('shows a batch label and unassigns across every selected photo', async () => {
    mockSelectedPaths = new Set(['/root/a.jpg', '/root/b.jpg'])
    mockSelectedPerson = 'p1'
    mockPeople = [
      { id: 'p1', name: 'Jamie', coverFaceId: null, coverPhotoPath: null, faceCount: 2 }
    ]
    mockGetFacesForPhoto.mockResolvedValue([makeFace({ id: 'face-1', personId: 'p1' })])
    const user = userEvent.setup()
    const photo = makePhoto('/root/a.jpg')
    renderMenu(photo)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'a.jpg' }))
    await user.click(await screen.findByText('Not Jamie (2 Photos)'))

    expect(mockGetFacesForPhoto).toHaveBeenCalledWith('/root/a.jpg')
    expect(mockGetFacesForPhoto).toHaveBeenCalledWith('/root/b.jpg')
  })
})
