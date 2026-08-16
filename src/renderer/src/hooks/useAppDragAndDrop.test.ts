import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PersonRecord, PhotoRecord } from '@shared/types'

const {
  mockMovePhotosToFolder,
  mockAddTagsToPhotos,
  mockAssignTagToGroup,
  mockAssignFaceToPerson,
  mockMergePeople,
  mockNotificationsShow
} = vi.hoisted(() => ({
  mockMovePhotosToFolder: vi.fn(),
  mockAddTagsToPhotos: vi.fn().mockResolvedValue(undefined),
  mockAssignTagToGroup: vi.fn(),
  mockAssignFaceToPerson: vi.fn(),
  mockMergePeople: vi.fn().mockResolvedValue(undefined),
  mockNotificationsShow: vi.fn()
}))

let mockPeople: PersonRecord[] = []
let mockPhotosByPath = new Map<string, PhotoRecord>()

vi.mock('@renderer/state/PhotoLibrarySidebarContext', () => ({
  useSidebarLibrary: () => ({ state: { people: mockPeople } })
}))
vi.mock('@renderer/state/PhotoLibraryGalleryContext', () => ({
  useGalleryLibrary: () => ({ state: { photosByPath: mockPhotosByPath } })
}))
vi.mock('@renderer/state/PhotoLibraryActionsContext', () => ({
  useLibraryActions: () => ({
    movePhotosToFolder: mockMovePhotosToFolder,
    addTagsToPhotos: mockAddTagsToPhotos,
    assignTagToGroup: mockAssignTagToGroup,
    assignFaceToPerson: mockAssignFaceToPerson,
    mergePeople: mockMergePeople
  })
}))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mockNotificationsShow } }))

import { useAppDragAndDrop } from './useAppDragAndDrop'

function makeDragStart(data: Record<string, unknown>, id = 'active-1'): DragStartEvent {
  return { active: { id, data: { current: data } } } as unknown as DragStartEvent
}

function makeDragEnd(
  activeData: Record<string, unknown>,
  overData: Record<string, unknown> | null,
  activeId = 'active-1',
  overId = 'over-1'
): DragEndEvent {
  return {
    active: { id: activeId, data: { current: activeData } },
    over: overData === null ? null : { id: overId, data: { current: overData } }
  } as unknown as DragEndEvent
}

function makePerson(id: string, name: string | null): PersonRecord {
  return { id, name, coverFaceId: null, coverPhotoPath: null, faceCount: 0, description: null }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPeople = []
  mockPhotosByPath = new Map()
})

describe('handleDragStart', () => {
  it('detects a tag drag', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragStart(makeDragStart({ tag: 'vacation' })))
    expect(result.current.activeDrag).toEqual({ kind: 'tag', tag: 'vacation' })
  })

  it('detects a face drag', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragStart(makeDragStart({ faceId: 'f1' })))
    expect(result.current.activeDrag).toEqual({ kind: 'face', faceId: 'f1' })
  })

  it('detects a person drag', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() =>
      result.current.handleDragStart(makeDragStart({ personId: 'p1', personName: 'Alice' }))
    )
    expect(result.current.activeDrag).toEqual({
      kind: 'person',
      personId: 'p1',
      personName: 'Alice'
    })
  })

  it('falls back to a photo drag using the active id when no paths are given', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragStart(makeDragStart({}, '/a.jpg')))
    expect(result.current.activeDrag).toEqual({ kind: 'photo', paths: ['/a.jpg'] })
  })

  it('uses the given paths for a multi-select photo drag', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() =>
      result.current.handleDragStart(makeDragStart({ paths: ['/a.jpg', '/b.jpg'] }, '/a.jpg'))
    )
    expect(result.current.activeDrag).toEqual({ kind: 'photo', paths: ['/a.jpg', '/b.jpg'] })
  })
})

describe('handleDragEnd', () => {
  it('assigns a tag to a group when dropped on a group droppable', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragEnd(makeDragEnd({ tag: 'vacation' }, { groupId: 'g1' })))
    expect(mockAssignTagToGroup).toHaveBeenCalledWith('vacation', 'g1')
  })

  it('clears the tag group when dropped on the ungrouped droppable (groupId: null)', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragEnd(makeDragEnd({ tag: 'vacation' }, { groupId: null })))
    expect(mockAssignTagToGroup).toHaveBeenCalledWith('vacation', null)
  })

  it('does nothing for a tag dropped somewhere without a groupId droppable', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragEnd(makeDragEnd({ tag: 'vacation' }, {})))
    expect(mockAssignTagToGroup).not.toHaveBeenCalled()
  })

  it('assigns a face to a person when dropped on a person droppable', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragEnd(makeDragEnd({ faceId: 'f1' }, { personId: 'p1' })))
    expect(mockAssignFaceToPerson).toHaveBeenCalledWith('f1', 'p1')
  })

  it('stages a person merge, resolving the target name from state', () => {
    mockPeople = [makePerson('p2', 'Bob')]
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() =>
      result.current.handleDragEnd(
        makeDragEnd({ personId: 'p1', personName: 'Alice' }, { personId: 'p2' })
      )
    )
    expect(result.current.pendingMerge).toEqual({
      sourceId: 'p1',
      sourceName: 'Alice',
      targetId: 'p2',
      targetName: 'Bob'
    })
  })

  it('does not stage a merge when a person is dropped on itself', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() =>
      result.current.handleDragEnd(
        makeDragEnd({ personId: 'p1', personName: 'Alice' }, { personId: 'p1' })
      )
    )
    expect(result.current.pendingMerge).toBeNull()
  })

  it('moves photos to a folder when dropped on a folder droppable', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() =>
      result.current.handleDragEnd(makeDragEnd({ paths: ['/a.jpg'] }, { folderPath: '/dest' }))
    )
    expect(mockMovePhotosToFolder).toHaveBeenCalledWith(['/a.jpg'], '/dest')
  })

  it('adds a tag to the dragged photos when dropped on a tag droppable', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragEnd(makeDragEnd({ paths: ['/a.jpg'] }, { tag: 'vacation' })))
    expect(mockAddTagsToPhotos).toHaveBeenCalledWith(['vacation'], ['/a.jpg'])
  })

  it('does nothing when dropped outside any droppable (over is null)', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragEnd(makeDragEnd({ paths: ['/a.jpg'] }, null)))
    expect(mockMovePhotosToFolder).not.toHaveBeenCalled()
    expect(mockAddTagsToPhotos).not.toHaveBeenCalled()
  })

  it('clears activeDrag unconditionally, even before checking the drop target', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragStart(makeDragStart({ tag: 'vacation' })))
    expect(result.current.activeDrag).not.toBeNull()

    act(() => result.current.handleDragEnd(makeDragEnd({ tag: 'vacation' }, null)))
    expect(result.current.activeDrag).toBeNull()
  })
})

describe('handleDragCancel', () => {
  it('clears activeDrag', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragStart(makeDragStart({ tag: 'vacation' })))
    act(() => result.current.handleDragCancel())
    expect(result.current.activeDrag).toBeNull()
  })
})

describe('handleConfirmMerge', () => {
  it('calls mergePeople with the staged ids and clears pendingMerge on success', async () => {
    mockPeople = [makePerson('p2', 'Bob')]
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() =>
      result.current.handleDragEnd(
        makeDragEnd({ personId: 'p1', personName: 'Alice' }, { personId: 'p2' })
      )
    )

    await act(() => result.current.handleConfirmMerge())

    expect(mockMergePeople).toHaveBeenCalledWith('p1', 'p2')
    expect(result.current.pendingMerge).toBeNull()
  })

  it('is a no-op when there is no pending merge', async () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    await act(() => result.current.handleConfirmMerge())
    expect(mockMergePeople).not.toHaveBeenCalled()
  })
})

describe('activeDragPhoto', () => {
  it('resolves the photo record for the first dragged path during a photo drag', () => {
    const photo = { filePath: '/a.jpg' } as PhotoRecord
    mockPhotosByPath = new Map([['/a.jpg', photo]])
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragStart(makeDragStart({ paths: ['/a.jpg'] })))
    expect(result.current.activeDragPhoto).toBe(photo)
  })

  it('is undefined for a non-photo drag', () => {
    const { result } = renderHook(() => useAppDragAndDrop())
    act(() => result.current.handleDragStart(makeDragStart({ tag: 'vacation' })))
    expect(result.current.activeDragPhoto).toBeUndefined()
  })
})
