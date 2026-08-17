import { useState } from 'react'

import {
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { notifications } from '@mantine/notifications'

import { useLibraryActions } from '@renderer/state/PhotoLibraryActionsContext'
import { useGalleryLibrary } from '@renderer/state/PhotoLibraryGalleryContext'
import { useSidebarLibrary } from '@renderer/state/PhotoLibrarySidebarContext'
import type { PhotoRecord } from '@shared/types'

export type ActiveDrag =
  | { kind: 'photo'; paths: string[] }
  | { kind: 'tag'; tag: string }
  | { kind: 'face'; faceId: string }
  | { kind: 'person'; personId: string; personName: string | null }
  | null

interface PendingMerge {
  sourceId: string
  sourceName: string
  targetId: string
  targetName: string
}

interface UseAppDragAndDropResult {
  sensors: ReturnType<typeof useSensors>
  activeDrag: ActiveDrag
  activeDragPhoto: PhotoRecord | undefined
  handleDragStart: (event: DragStartEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  handleDragCancel: () => void
  pendingMerge: PendingMerge | null
  mergeSaving: boolean
  handleConfirmMerge: () => Promise<void>
  cancelPendingMerge: () => void
}

// Orchestrates AppLayout's four drag domains (photo/tag/face/person) sharing one DndContext, plus
// the confirm-step staging a person-merge needs (unlike a face assignment, it deletes a row).
export function useAppDragAndDrop(): UseAppDragAndDropResult {
  const { state: sidebarState } = useSidebarLibrary()
  const { state } = useGalleryLibrary()
  const { movePhotosToFolder, addTagsToPhotos, assignTagToGroup, assignFaceToPerson, mergePeople } =
    useLibraryActions()

  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null)
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null)
  const [mergeSaving, setMergeSaving] = useState(false)

  const handleConfirmMerge = async (): Promise<void> => {
    if (!pendingMerge) return
    setMergeSaving(true)
    try {
      await mergePeople(pendingMerge.sourceId, pendingMerge.targetId)
      setPendingMerge(null)
    } finally {
      setMergeSaving(false)
    }
  }

  const sensors = useSensors(
    // Requires a small pointer move before a drag "starts," so an ordinary
    // click (select, rename, etc.) is never mistaken for a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragStart = (event: DragStartEvent): void => {
    const data = event.active.data.current as
      | {
          paths?: string[]
          tag?: string
          faceId?: string
          personId?: string
          personName?: string | null
        }
      | undefined
    if (data?.tag) {
      setActiveDrag({ kind: 'tag', tag: data.tag })
      return
    }
    if (data?.faceId) {
      setActiveDrag({ kind: 'face', faceId: data.faceId })
      return
    }
    if (data?.personId) {
      setActiveDrag({
        kind: 'person',
        personId: data.personId,
        personName: data.personName ?? null
      })
      return
    }
    const paths = data?.paths
    setActiveDrag({
      kind: 'photo',
      paths: paths && paths.length > 0 ? paths : [String(event.active.id)]
    })
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as
      | {
          paths?: string[]
          tag?: string
          faceId?: string
          personId?: string
          personName?: string | null
        }
      | undefined
    if (activeData?.tag) {
      const overData = over.data.current as { groupId?: string | null } | undefined
      if (overData && 'groupId' in overData) {
        void assignTagToGroup(activeData.tag, overData.groupId ?? null)
      }
      return
    }

    if (activeData?.faceId) {
      const overData = over.data.current as { personId?: string } | undefined
      if (overData?.personId) {
        void assignFaceToPerson(activeData.faceId, overData.personId)
      }
      return
    }

    if (activeData?.personId) {
      const overData = over.data.current as { personId?: string } | undefined
      if (overData?.personId && overData.personId !== activeData.personId) {
        const targetName = sidebarState.people.find((p) => p.id === overData.personId)?.name
        setPendingMerge({
          sourceId: activeData.personId,
          sourceName: activeData.personName ?? 'Unnamed person',
          targetId: overData.personId,
          targetName: targetName ?? 'Unnamed person'
        })
      }
      return
    }

    const overData = over.data.current as { tag?: string; folderPath?: string } | undefined
    const paths = activeData?.paths
    if (!paths || paths.length === 0) return

    if (overData?.folderPath) {
      void movePhotosToFolder(paths, overData.folderPath)
      return
    }

    const tag = overData?.tag
    if (!tag) return
    void addTagsToPhotos([tag], paths).then(() => {
      notifications.show({
        color: 'teal',
        message: `Added #${tag} to ${paths.length} photo${paths.length === 1 ? '' : 's'}`
      })
    })
  }

  const activeDragPhoto =
    activeDrag?.kind === 'photo' ? state.photosByPath.get(activeDrag.paths[0]) : undefined

  return {
    sensors,
    activeDrag,
    activeDragPhoto,
    handleDragStart,
    handleDragEnd,
    handleDragCancel: () => setActiveDrag(null),
    pendingMerge,
    mergeSaving,
    handleConfirmMerge,
    cancelPendingMerge: () => setPendingMerge(null)
  }
}
