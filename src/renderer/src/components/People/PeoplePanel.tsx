import { memo, type ReactElement, useCallback, useRef, useState } from 'react'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  ActionIcon,
  AspectRatio,
  Badge,
  Button,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core'
import { useHover, useMergedRef } from '@mantine/hooks'
import { IconPencil } from '@tabler/icons-react'

import { FaceCropThumbnail, PanelSection } from '@components'
import type { PersonRecord } from '@shared/types'
import { useLibraryActions, useSidebarLibrary } from '@state'
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
  isActive: boolean
  coverThumbnailKey: string | null | undefined
  onStartEdit: (personId: string) => void
  onStopEdit: () => void
}

// No usePhotoLibrary()/sidebar-state subscription of its own beyond the
// permanently-stable actions bag — isActive/coverThumbnailKey come from the
// parent (PeoplePanel), and onStartEdit/onStopEdit are passed through
// unbound, so this row's props stay reference-stable across an unrelated
// re-render, letting React.memo below bail out. Mirrors FolderTree's TreeRow.
const PersonRow = memo(function PersonRow({
  person,
  editing,
  isActive,
  coverThumbnailKey,
  onStartEdit,
  onStopEdit
}: PersonRowProps): ReactElement {
  const { renamePerson, hidePerson, deletePerson, setPersonFilter } = useLibraryActions()
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
        onRename={() => onStartEdit(person.id)}
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
            coverThumbnailKey &&
            person.coverFaceBox && (
              <AspectRatio ratio={1 / 1}>
                <FaceCropThumbnail
                  thumbnailKey={coverThumbnailKey}
                  box={person.coverFaceBox}
                  size={COVER_SIZE}
                  radius="md"
                />
              </AspectRatio>
            )
          }
          rightSection={
            <>
              {!editing && (
                <Tooltip label="Rename person">
                  {/* div, not a nested <button> — this sits inside the row's
                      Button, and button-in-button is invalid HTML */}
                  <ActionIcon
                    component="div"
                    role="button"
                    opacity={hovered ? 0.7 : 0}
                    style={{ flexShrink: 0 }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onStartEdit(person.id)
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
      {/* Mounted only while open — a Mantine Modal renders its whole
          ModalBase/Transition/overlay tree even when closed, and this is one
          row of many (same fix as TagPanel's TagListItem dialogs). */}
      {confirmingHide && (
        <PersonHideDialog
          name={displayName}
          opened
          saving={saving}
          onConfirm={() => void handleHide()}
          onCancel={() => setConfirmingHide(false)}
        />
      )}
      {confirmingDelete && (
        <PersonDeleteDialog
          name={displayName}
          opened
          saving={saving}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  )
})

// Mirrors TagPanel's shape (PanelSection + list of rows), but people aren't
// nested in groups the way tags are — a flat list, since merging one person
// into another (via drag-and-drop) already covers the "combine" case a
// group hierarchy would otherwise be for.
interface PeoplePanelProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

// Memoized so a re-render of its parent (e.g. NavbarSplitter during a
// Splitter drag) doesn't force this whole panel to re-render when its own
// props (collapsed/onToggleCollapse) haven't changed.
export const PeoplePanel = memo(function PeoplePanel({
  collapsed,
  onToggleCollapse
}: PeoplePanelProps = {}): ReactElement {
  const { state, personCoverPhotos } = useSidebarLibrary()
  const { setPersonFilter, enableFaceDetection, rescanFaces } = useLibraryActions()
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)
  const handleStopEdit = useCallback(() => setEditingPersonId(null), [])
  // Drives the button's own spinner for a click made right here — separate
  // from state.faceScanInProgress (below), which also covers a scan started
  // elsewhere (e.g. the Settings toggle) so this button stays disabled for
  // that too, without needing the full per-tick faceScanProgress object.
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  const handleScan = async (): Promise<void> => {
    setScanError(null)
    setScanning(true)
    try {
      // Already-enabled means a prior scan just came up empty (or everyone
      // got merged/deleted/hidden away) — re-detect rather than re-flip the
      // setting.
      await (state.faceDetectionEnabled ? rescanFaces() : enableFaceDetection())
    } catch (err) {
      console.error('failed to start face scan', err)
      setScanError('Failed to scan your library for faces.')
    } finally {
      setScanning(false)
    }
  }

  if (state.people.length === 0) {
    return (
      <PanelSection title="People" collapsed={collapsed} onToggleCollapse={onToggleCollapse}>
        <Stack gap="xs" p="xs">
          <Text c="dimmed" size="sm">
            No people yet.
          </Text>
          <Button
            loading={scanning}
            disabled={state.faceScanInProgress}
            onClick={() => void handleScan()}
          >
            Scan for faces
          </Button>
          {scanError && <Text c="red">{scanError}</Text>}
        </Stack>
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
                coverThumbnailKey={personCoverPhotos.get(person.id)}
                coverFaceBox={person.coverFaceBox}
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
              isActive={state.selectedPerson === person.id}
              coverThumbnailKey={personCoverPhotos.get(person.id)}
              onStartEdit={setEditingPersonId}
              onStopEdit={handleStopEdit}
            />
          ))}
        </Stack>
      )}
    </PanelSection>
  )
})
