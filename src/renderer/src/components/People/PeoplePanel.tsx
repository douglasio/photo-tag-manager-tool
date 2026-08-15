import { type ReactElement, useRef, useState } from 'react'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  ActionIcon,
  AspectRatio,
  Badge,
  Button,
  Image,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core'
import { useHover, useMergedRef } from '@mantine/hooks'
import { IconPencil } from '@tabler/icons-react'

import { PanelSection } from '@components'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PersonRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { activeHoverBackground } from '@utils'

import { PeopleSettingsMenu } from './PeopleSettingsMenu'
import { PersonContextMenu } from './PersonContextMenu'
import { PersonDeleteDialog } from './PersonDeleteDialog'
import { PersonGridTile } from './PersonGridTile'
import { PersonHideDialog } from './PersonHideDialog'

const COVER_SIZE = 32

interface PersonRowProps {
  person: PersonRecord
  editing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
}

function PersonRow({ person, editing, onStartEdit, onStopEdit }: PersonRowProps): ReactElement {
  const { state, renamePerson, hidePerson, deletePerson, setPersonFilter } = usePhotoLibrary()
  const isActive = state.selectedPerson === person.id
  const { hovered, ref: hoverRef } = useHover<HTMLButtonElement>()
  // Drop target for a face dragged from DetailPanelFaces (assign) or another
  // person row dragged from below (merge) — see handleDragEnd's
  // faceId/personId branches in App.tsx.
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `person:${person.id}`,
    data: { personId: person.id }
  })
  // Drag source for merging this person into another one — a different id
  // than the droppable above (dnd-kit wants drag/drop ids distinct), same
  // "-drag" suffix convention TagListItem uses for tag-into-group drags.
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging
  } = useDraggable({
    id: `person-drag:${person.id}`,
    data: { personId: person.id, personName: person.name },
    disabled: editing
  })
  // Separate plain ref for the description Tooltip's `target` — Mantine's
  // Tooltip only forwards a fixed prop whitelist onto a wrapped child, which
  // silently drops Menu.ContextMenu's onContextMenu handler if the Tooltip
  // wraps the button as a parent (see TagPanel.tsx's own fix for the same
  // issue). Using `target` instead of wrapping avoids it entirely.
  const buttonRef = useRef<HTMLButtonElement>(null)
  const ref = useMergedRef(hoverRef, setDropRef, setDragRef, buttonRef)

  const displayName = person.name ?? 'Unnamed person'
  const coverThumbnailKey = person.coverPhotoPath
    ? state.photosByPath.get(person.coverPhotoPath)?.thumbnailKey
    : null

  // Inline rename, matching TagListItem's edit style (no confirm dialog —
  // unlike a tag rename, this never touches photo files, just a DB row).
  const [draft, setDraft] = useState(person.name ?? '')
  // Adjust-during-render reset for when editing is triggered externally (the
  // pencil icon) — same pattern TagListItem/FolderTree's rename rows use.
  const [wasEditing, setWasEditing] = useState(editing)
  if (editing !== wasEditing) {
    setWasEditing(editing)
    if (editing) setDraft(person.name ?? '')
  }

  const [saving, setSaving] = useState(false)
  const [confirmingHide, setConfirmingHide] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const cancel = (): void => {
    setDraft(person.name ?? '')
    onStopEdit()
  }

  const attemptSave = async (): Promise<void> => {
    if (saving) return
    const trimmed = draft.trim()
    if (trimmed === (person.name ?? '')) {
      onStopEdit()
      return
    }
    setSaving(true)
    try {
      await renamePerson(person.id, trimmed)
      onStopEdit()
    } catch (err) {
      console.error(`failed to rename person ${person.id}`, err)
      // Leave editing open so the user can retry or press Escape to cancel.
    } finally {
      setSaving(false)
    }
  }

  const handleHide = async (): Promise<void> => {
    setSaving(true)
    try {
      await hidePerson(person.id)
      setConfirmingHide(false)
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

  return (
    <>
      <PersonContextMenu
        onRename={onStartEdit}
        onHide={() => setConfirmingHide(true)}
        onDelete={() => setConfirmingDelete(true)}
      >
        {/* Edit mode reuses the exact same Button/leftSection/padding chrome
            as view mode, only swapping Text for a TextInput as the button's
            content — otherwise the differing padding/gap shifts the row's
            font size and horizontal position when toggling (same reasoning
            as TagListItem/FolderTree's rename rows). */}
        <Button
          ref={ref}
          {...attributes}
          {...listeners}
          fullWidth
          h="auto"
          py={6}
          justify="space-between"
          variant="transparent"
          opacity={isDragging ? 0.4 : undefined}
          onClick={() => {
            if (editing) return
            setPersonFilter(isActive ? null : person.id)
          }}
          bg={
            isOver ? 'var(--mantine-primary-color-light)' : activeHoverBackground(isActive, hovered)
          }
          style={{
            outline: isOver ? '2px dashed var(--mantine-primary-color-filled)' : undefined,
            outlineOffset: -2
          }}
          styles={{
            label: {
              flex: 1,
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center'
            }
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
            <>
              {!editing && (
                <Tooltip label="Rename person">
                  <ActionIcon
                    opacity={hovered ? 0.7 : 0}
                    style={{ flexShrink: 0 }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onStartEdit()
                    }}
                    aria-label={`Rename ${displayName}`}
                  >
                    <IconPencil />
                  </ActionIcon>
                </Tooltip>
              )}
              <Badge size="md" variant="light" style={{ flexShrink: 0 }}>
                {person.faceCount}
              </Badge>
            </>
          }
        >
          {editing ? (
            <TextInput
              autoFocus
              variant="unstyled"
              value={draft}
              w="100%"
              disabled={saving}
              placeholder="Unnamed person"
              onChange={(event) => setDraft(event.currentTarget.value)}
              onBlur={() => void attemptSave()}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void attemptSave()
                } else if (event.key === 'Escape') {
                  cancel()
                }
              }}
              styles={{ input: { padding: 0, height: 'auto', minHeight: 'auto' } }}
            />
          ) : (
            <Text display="block" ta="left" truncate="end">
              {displayName}
            </Text>
          )}
        </Button>
      </PersonContextMenu>
      {person.description && (
        <Tooltip
          target={buttonRef}
          position="right"
          label={
            <Text size="xs" maw={220}>
              {person.description}
            </Text>
          }
          disabled={editing}
          openDelay={700}
          multiline
        />
      )}
      <PersonHideDialog
        name={displayName}
        opened={confirmingHide}
        saving={saving}
        onConfirm={() => void handleHide()}
        onCancel={() => setConfirmingHide(false)}
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
interface PeoplePanelProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function PeoplePanel({ collapsed, onToggleCollapse }: PeoplePanelProps = {}): ReactElement {
  const { state, setPersonFilter } = usePhotoLibrary()
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)

  if (state.people.length === 0) {
    return (
      <PanelSection title="People" collapsed={collapsed} onToggleCollapse={onToggleCollapse}>
        <Text c="dimmed" p="xs">
          No people yet — run a face scan from Settings to get started.
        </Text>
      </PanelSection>
    )
  }

  return (
    <PanelSection
      title="People"
      headerAction={<PeopleSettingsMenu />}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      {state.peoplePanelGridView ? (
        <SimpleGrid cols={2} spacing="xs" p="xs">
          {state.people.map((person) => {
            const isActive = state.selectedPerson === person.id
            return (
              <PersonGridTile
                key={person.id}
                name={person.name ?? 'Unnamed person'}
                faceCount={person.faceCount}
                coverThumbnailKey={
                  person.coverPhotoPath
                    ? state.photosByPath.get(person.coverPhotoPath)?.thumbnailKey
                    : null
                }
                isActive={isActive}
                onSelect={() => setPersonFilter(isActive ? null : person.id)}
              />
            )
          })}
        </SimpleGrid>
      ) : (
        <Stack gap={0}>
          {state.people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              editing={editingPersonId === person.id}
              onStartEdit={() => setEditingPersonId(person.id)}
              onStopEdit={() => setEditingPersonId(null)}
            />
          ))}
        </Stack>
      )}
    </PanelSection>
  )
}
