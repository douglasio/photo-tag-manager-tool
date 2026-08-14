import { type ReactElement, useEffect, useState } from 'react'

import { useDraggable } from '@dnd-kit/core'
import { Box, Group, Menu, Stack, Text } from '@mantine/core'
import { IconUserSquare } from '@tabler/icons-react'

import { SectionTitle } from '@components'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { FaceRecord } from '@shared/types'
import { type DisplayPhotoRecord, usePhotoLibrary } from '@state'

const THUMB_SIZE = 56

interface FaceCropThumbnailProps {
  thumbnailKey: string
  box: FaceRecord['box']
}

// Crops a face out of the photo's own thumbnail purely with CSS (percentage
// width/height/offset relative to the crop box) — no separate per-face
// image file exists, so this reuses the same thumbnail every face on this
// photo shares.
function FaceCropThumbnail({ thumbnailKey, box }: FaceCropThumbnailProps): ReactElement {
  return (
    <Box
      w={THUMB_SIZE}
      h={THUMB_SIZE}
      bdrs="sm"
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      <img
        src={toThumbProtocolUrl(thumbnailKey)}
        alt=""
        style={{
          position: 'absolute',
          width: `${100 / box.w}%`,
          height: `${100 / box.h}%`,
          left: `${(-100 * box.x) / box.w}%`,
          top: `${(-100 * box.y) / box.h}%`,
          maxWidth: 'none'
        }}
      />
    </Box>
  )
}

interface FaceItemProps {
  face: FaceRecord
  thumbnailKey: string
}

function FaceItem({ face, thumbnailKey }: FaceItemProps): ReactElement {
  const { state, assignFaceToPerson, splitFaceAsNewPerson, unassignFace } = usePhotoLibrary()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `face-drag:${face.id}`,
    data: { faceId: face.id }
  })

  const person = face.personId ? state.people.find((p) => p.id === face.personId) : undefined
  const otherPeople = state.people.filter((p) => p.id !== face.personId)

  return (
    <Stack gap={2} align="center" w={THUMB_SIZE}>
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Box
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            opacity={isDragging ? 0.4 : undefined}
            style={{ cursor: 'pointer' }}
          >
            <FaceCropThumbnail thumbnailKey={thumbnailKey} box={face.box} />
          </Box>
        </Menu.Target>
        <Menu.Dropdown>
          {otherPeople.length > 0 && (
            <>
              <Menu.Label>Assign to</Menu.Label>
              {otherPeople.map((p) => (
                <Menu.Item key={p.id} onClick={() => void assignFaceToPerson(face.id, p.id)}>
                  {p.name ?? 'Unnamed person'}
                </Menu.Item>
              ))}
            </>
          )}
          <Menu.Item onClick={() => void splitFaceAsNewPerson(face.id)}>
            {person ? 'Not this person' : 'New person'}
          </Menu.Item>
          {face.personId && (
            <Menu.Item color="red" onClick={() => void unassignFace(face.id)}>
              Unassign
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
      <Text size="xs" c="dimmed" truncate="end" w="100%" ta="center">
        {person?.name ?? 'Unassigned'}
      </Text>
    </Stack>
  )
}

interface DetailPanelFacesProps {
  photo: DisplayPhotoRecord
}

// "Faces detected in this photo" — mirrors DetailPanelDuplicates' shape
// (fetch-on-photo-change, returns null when empty), but each thumbnail is
// also a drag source (onto a person in PeoplePanel) and a menu for manual
// assign/split/unassign.
export function DetailPanelFaces({ photo }: DetailPanelFacesProps): ReactElement | null {
  const { getFacesForPhoto } = usePhotoLibrary()
  const [faces, setFaces] = useState<FaceRecord[]>([])

  const [trackedPath, setTrackedPath] = useState(photo.filePath)
  if (trackedPath !== photo.filePath) {
    setTrackedPath(photo.filePath)
    setFaces([])
  }

  useEffect(() => {
    let cancelled = false
    getFacesForPhoto(photo.filePath)
      .then((results) => {
        if (!cancelled) setFaces(results)
      })
      .catch((err: unknown) => {
        console.error(`failed to get faces for ${photo.filePath}`, err)
      })
    return () => {
      cancelled = true
    }
  }, [photo.filePath, getFacesForPhoto])

  if (faces.length === 0 || !photo.thumbnailKey) return null
  const thumbnailKey = photo.thumbnailKey

  return (
    <Stack gap="xs">
      <Group gap={4}>
        <IconUserSquare size={14} />
        <SectionTitle>Faces</SectionTitle>
      </Group>
      <Group gap="xs" align="flex-start">
        {faces.map((face) => (
          <FaceItem key={face.id} face={face} thumbnailKey={thumbnailKey} />
        ))}
      </Group>
    </Stack>
  )
}
