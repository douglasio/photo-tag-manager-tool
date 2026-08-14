import { type ReactElement, useState } from 'react'

import { useDroppable } from '@dnd-kit/core'
import { AspectRatio, Badge, Button, Image, Stack, Text } from '@mantine/core'
import { useHover, useMergedRef } from '@mantine/hooks'

import { PanelSection } from '@components'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PersonRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { activeHoverBackground } from '@utils'

import { PersonContextMenu } from './PersonContextMenu'
import { PersonDeleteDialog } from './PersonDeleteDialog'
import { PersonNameDialog } from './PersonNameDialog'

const COVER_SIZE = 32

interface PersonRowProps {
  person: PersonRecord
}

function PersonRow({ person }: PersonRowProps): ReactElement {
  const { state, renamePerson, deletePerson } = usePhotoLibrary()
  const { hovered, ref: hoverRef } = useHover<HTMLButtonElement>()
  // Drop target for a face dragged from DetailPanelFaces — see
  // handleDragEnd's faceId/personId branch in App.tsx.
  const { isOver, setNodeRef } = useDroppable({
    id: `person:${person.id}`,
    data: { personId: person.id }
  })
  const ref = useMergedRef(hoverRef, setNodeRef)

  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const coverThumbnailKey = person.coverPhotoPath
    ? state.photosByPath.get(person.coverPhotoPath)?.thumbnailKey
    : null

  const handleRename = async (name: string): Promise<void> => {
    setSaving(true)
    try {
      await renamePerson(person.id, name)
      setRenaming(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    setSaving(true)
    try {
      await deletePerson(person.id)
      setConfirmingDelete(false)
    } finally {
      setSaving(false)
    }
  }

  const displayName = person.name ?? 'Unnamed person'

  return (
    <>
      <PersonContextMenu
        onRename={() => setRenaming(true)}
        onDelete={() => setConfirmingDelete(true)}
      >
        <Button
          ref={ref}
          fullWidth
          h="auto"
          py={6}
          justify="space-between"
          variant="transparent"
          bg={isOver ? 'var(--mantine-primary-color-light)' : activeHoverBackground(false, hovered)}
          style={{
            outline: isOver ? '2px dashed var(--mantine-primary-color-filled)' : undefined,
            outlineOffset: -2
          }}
          leftSection={
            coverThumbnailKey && (
              <AspectRatio ratio={1 / 1}>
                <Image
                  src={toThumbProtocolUrl(coverThumbnailKey)}
                  w={COVER_SIZE}
                  h={COVER_SIZE}
                  fit="cover"
                  radius="sm"
                />
              </AspectRatio>
            )
          }
          rightSection={
            <Badge size="md" variant="light" style={{ flexShrink: 0 }}>
              {person.faceCount}
            </Badge>
          }
        >
          <Text display="block" ta="left" truncate="end">
            {displayName}
          </Text>
        </Button>
      </PersonContextMenu>
      <PersonNameDialog
        opened={renaming}
        saving={saving}
        initialName={person.name ?? ''}
        onConfirm={(name) => void handleRename(name)}
        onCancel={() => setRenaming(false)}
      />
      <PersonDeleteDialog
        name={displayName}
        opened={confirmingDelete}
        saving={saving}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  )
}

// Mirrors TagPanel's shape (PanelSection + list of rows), but people aren't
// nested in groups the way tags are — a flat list, since merging one person
// into another (via drag-and-drop) already covers the "combine" case a
// group hierarchy would otherwise be for.
export function PeoplePanel(): ReactElement {
  const { state } = usePhotoLibrary()

  if (state.people.length === 0) {
    return (
      <PanelSection title="People">
        <Text c="dimmed" p="xs">
          No people yet — run a face scan from Settings to get started.
        </Text>
      </PanelSection>
    )
  }

  return (
    <PanelSection title="People">
      <Stack gap={0}>
        {state.people.map((person) => (
          <PersonRow key={person.id} person={person} />
        ))}
      </Stack>
    </PanelSection>
  )
}
