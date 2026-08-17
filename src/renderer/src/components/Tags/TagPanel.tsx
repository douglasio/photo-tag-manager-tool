import { memo, type ReactElement, useCallback, useRef, useState } from 'react'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  Accordion,
  ActionIcon,
  AspectRatio,
  Badge,
  Box,
  Button,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core'
import { useHover, useMergedRef } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconPencil } from '@tabler/icons-react'

import {
  PanelSection,
  TagGridTile,
  TagGroupCreateButton,
  TagHoverCardTarget,
  TagsSettingsMenu
} from '@components'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord, TagGroup } from '@shared/types'
import { useActiveDragKind, useLibraryActions, useSidebarLibrary } from '@state'
import { activeHoverBackground, PREVIEW_TRIGGER_KEY } from '@utils'

import { TagContextMenu } from './TagContextMenu'
import { TagDeleteDialog } from './TagDeleteDialog'
import { TagGroupContextMenu } from './TagGroupContextMenu'
import { TagGroupDeleteDialog } from './TagGroupDeleteDialog'
import { TagGroupNameDialog } from './TagGroupNameDialog'
import { TagGroupPatternDialog } from './TagGroupPatternDialog'
import { TagRenameDialog } from './TagRenameDialog'
const COVER_SIZE = 28

interface TagListItemProps {
  tag: string
  count: number
  description: string
  coverPhoto: PhotoRecord | undefined
  isActive: boolean
  editing: boolean
  // Only draggable once there's at least one group to drag it into — no
  // point offering the affordance with nowhere for a drop to land.
  draggable: boolean
  onSelect: (tag: string | null) => void
  onStartEdit: (tag: string) => void
  onStopEdit: () => void
  onRename: (tag: string, newTag: string) => Promise<void>
  onDelete: (tag: string) => Promise<void>
}

// Deliberately thin: this is the only part that subscribes to dnd-kit's
// InternalContext (via useDroppable/useDraggable), which gets a new identity
// every time the hovered drop target changes mid-drag. React re-renders every
// context consumer on that change, so with hundreds of tag rows the heavy
// Mantine subtree below used to re-render hundreds of times per drag — the
// single largest remaining cost in the drag profile.
//
// Everything dnd-kit hands back here is either referentially stable
// (setNodeRef, the memoized listeners/attributes) or changes for just one or
// two rows (isOver, isDragging), so TagListItemView's memo actually bails out
// for the other rows instead of re-rendering the whole list.
function TagListItem(props: TagListItemProps): ReactElement {
  const { tag, draggable, editing } = props
  // Tags are drop targets for photos (dragging a photo onto one adds the
  // tag), but not for other tags — only a group's control should light up
  // while a tag is being dragged, so this droppable is switched off for
  // that case rather than just hiding the isOver highlight (also keeps it
  // out of collision detection entirely).
  // Deliberately NOT dnd-kit's useDndContext() — that re-renders every
  // consumer on each pointermove; this only changes on drag start/end.
  const isDraggingTag = useActiveDragKind() === 'tag'
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `tag:${tag}`,
    data: { tag },
    disabled: isDraggingTag
  })
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging
  } = useDraggable({
    id: `tag-drag:${tag}`,
    data: { tag },
    disabled: !draggable || editing
  })

  return (
    <TagListItemView
      {...props}
      isOver={isOver}
      isDragging={isDragging}
      setDropRef={setDropRef}
      setDragRef={setDragRef}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  )
}

interface TagListItemViewProps extends TagListItemProps {
  isOver: boolean
  isDragging: boolean
  setDropRef: (element: HTMLElement | null) => void
  setDragRef: (element: HTMLElement | null) => void
  // Sourced from useDraggable's own return type rather than restated, so
  // these stay correct if dnd-kit's shape changes.
  dragAttributes: ReturnType<typeof useDraggable>['attributes']
  dragListeners: ReturnType<typeof useDraggable>['listeners']
}

// No usePhotoLibrary()/sidebar-state subscription — already fully
// props-driven. Callback props are passed through unbound by the parent
// (TagPanel), rather than one new closure per tag per render, so they stay
// reference-stable and this memo can actually bail out. Mirrors FolderTree's
// TreeRow/PeoplePanel's PersonRow.
const TagListItemView = memo(function TagListItemView({
  tag,
  count,
  description,
  coverPhoto,
  isActive,
  editing,
  onSelect,
  onStartEdit,
  onStopEdit,
  onRename,
  onDelete,
  isOver,
  isDragging,
  setDropRef,
  setDragRef,
  dragAttributes,
  dragListeners
}: TagListItemViewProps): ReactElement {
  const { hovered, ref: hoverRef } = useHover<HTMLButtonElement>()
  const attributes = dragAttributes
  const listeners = dragListeners
  // Mantine's Tooltip only forwards a fixed prop whitelist (onClick,
  // onMouseEnter, ...) onto a wrapped child — onContextMenu isn't in it, so
  // Menu.ContextMenu's right-click handler never reached the button when
  // Tooltip wrapped it as a parent. Using Tooltip's `target` prop instead
  // (a plain ref to the button) decouples the two, so the description
  // tooltip no longer swallows the button's own context-menu events.
  const buttonRef = useRef<HTMLButtonElement>(null)
  const ref = useMergedRef(hoverRef, setDropRef, setDragRef, buttonRef)

  const [draft, setDraft] = useState(tag)
  // Adjust-during-render reset (not a useEffect) for when editing is
  // triggered externally — the pencil icon or the right-click menu — same
  // pattern used by FolderTree for the folder rename flow this mirrors.
  const [wasEditing, setWasEditing] = useState(editing)
  if (editing !== wasEditing) {
    setWasEditing(editing)
    if (editing) setDraft(tag)
  }

  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const trimmed = draft.trim()
  const canAttemptSave = trimmed.length > 0 && trimmed !== tag

  const attemptSave = (): void => {
    if (confirming) return
    if (!canAttemptSave) {
      setDraft(tag)
      onStopEdit()
      return
    }
    setConfirming(true)
  }

  const cancel = (): void => {
    setDraft(tag)
    onStopEdit()
  }

  const handleCancelConfirm = (): void => {
    setConfirming(false)
    cancel()
  }

  const handleConfirm = async (): Promise<void> => {
    setSaving(true)
    try {
      await onRename(tag, trimmed)
      setConfirming(false)
      onStopEdit()
      notifications.show({
        color: 'teal',
        message: `Updated tag name for ${count} photo${count === 1 ? '' : 's'}`
      })
    } catch {
      // onRename already surfaces an error toast — leave the dialog open so
      // the user can retry or cancel.
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = async (): Promise<void> => {
    setDeleting(true)
    try {
      await onDelete(tag)
      setConfirmingDelete(false)
      notifications.show({
        color: 'teal',
        message: `Deleted tag "${tag}" from ${count} photo${count === 1 ? '' : 's'}`
      })
    } catch {
      // onDelete already surfaces an error toast — leave the dialog open so
      // the user can retry or cancel.
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <TagContextMenu onRename={() => onStartEdit(tag)} onDelete={() => setConfirmingDelete(true)}>
        {/* Edit mode reuses the exact same Button/leftSection/padding chrome
            as view mode, only swapping Text for a TextInput as the button's
            content — otherwise the differing padding/gap shifts the row's
            font size and horizontal position when toggling (same reasoning
            as FolderTree's rename row). */}
        <Button
          ref={ref}
          {...attributes}
          {...listeners}
          onClick={() => {
            if (editing) return
            onSelect(isActive ? null : tag)
          }}
          // Space is the gallery's preview-trigger key, not a click here —
          // without this, a native space-triggers-click on this button (still
          // focused from the click that selected it) would re-fire onSelect
          // while previewing a thumbnail and toggle this tag's filter off.
          onKeyDown={(event) => {
            if (event.key === PREVIEW_TRIGGER_KEY) event.preventDefault()
          }}
          opacity={isDragging ? 0.4 : undefined}
          fullWidth
          h="auto"
          py={6}
          justify="space-between"
          variant="transparent"
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
            coverPhoto?.thumbnailStatus === 'ready' &&
            coverPhoto.thumbnailKey && (
              <AspectRatio ratio={1 / 1}>
                <Image
                  src={toThumbProtocolUrl(coverPhoto.thumbnailKey)}
                  w={COVER_SIZE}
                  h={COVER_SIZE}
                  fit="cover"
                />
              </AspectRatio>
            )
          }
          rightSection={
            <>
              {!editing && (
                <Tooltip label="Rename tag">
                  <ActionIcon
                    opacity={hovered ? 0.7 : 0}
                    style={{ flexShrink: 0 }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onStartEdit(tag)
                    }}
                    aria-label={`Rename #${tag}`}
                  >
                    <IconPencil />
                  </ActionIcon>
                </Tooltip>
              )}
              <Badge size="md" variant={isActive ? 'filled' : 'light'} style={{ flexShrink: 0 }}>
                {count}
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
              onChange={(event) => setDraft(event.currentTarget.value)}
              onBlur={attemptSave}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') {
                  event.preventDefault()
                  attemptSave()
                } else if (event.key === 'Escape') {
                  cancel()
                }
              }}
              styles={{ input: { padding: 0, height: 'auto', minHeight: 'auto' } }}
            />
          ) : (
            <Text display="block" ta="left" truncate="end">
              {tag}
            </Text>
          )}
          {description && !editing && (
            <Text display="block" truncate="end" size="xs" c="dimmed" lineClamp={1}>
              {description}
            </Text>
          )}
        </Button>
      </TagContextMenu>
      <TagHoverCardTarget tag={tag} target={buttonRef} disabled={editing} />
      {/* Mounted only while open. A Mantine Modal renders its whole
          ModalBase/Transition/overlay tree even with opened={false}, so
          keeping two per row mounted cost ~2x(rows) floating-UI subtrees on
          every render — the dominant cost in a hundreds-of-tags panel. */}
      {confirming && (
        <TagRenameDialog
          oldTag={tag}
          newTag={trimmed}
          count={count}
          opened
          saving={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={handleCancelConfirm}
        />
      )}
      {confirmingDelete && (
        <TagDeleteDialog
          tag={tag}
          count={count}
          opened
          saving={deleting}
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  )
})

interface TagGroupSectionProps {
  // null renders the synthetic "Other Tags" section — no rename/delete,
  // never removed itself, just whatever isn't in a real group.
  group: TagGroup | null
  tags: string[]
  existingGroupNames: string[]
  // Owns both the per-tag rendering and the container around it (a Stack of
  // rows in list mode, a SimpleGrid of tiles in grid mode) — left to the
  // caller since that differs by display mode, not by which group this is.
  renderTags: (tags: string[]) => ReactElement
}

function TagGroupSection({
  group,
  tags,
  existingGroupNames,
  renderTags
}: TagGroupSectionProps): ReactElement {
  const { renameTagGroup, updateTagGroupPattern, deleteTagGroup } = useLibraryActions()
  const { hovered, ref: hoverRef } = useHover<HTMLButtonElement>()
  // Groups are drop targets for tags (see TagListItem's draggable), not
  // photos — mirrors that component's own tag-vs-photo disabling so a
  // dragged photo doesn't light this up as if dropping it here did anything.
  // See TagListItem above — avoids useDndContext's per-pointermove churn.
  const isDraggingPhoto = useActiveDragKind() === 'photo'
  const { isOver, setNodeRef } = useDroppable({
    id: `group:${group?.id ?? 'other'}`,
    data: { groupId: group?.id ?? null },
    disabled: isDraggingPhoto
  })
  const ref = useMergedRef(hoverRef, setNodeRef)

  const [renaming, setRenaming] = useState(false)
  const [editingPattern, setEditingPattern] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleRename = async (name: string): Promise<void> => {
    if (!group) return
    setSaving(true)
    try {
      await renameTagGroup(group.id, name)
      setRenaming(false)
    } finally {
      setSaving(false)
    }
  }

  const handleEditPattern = async (matchPattern: string | null): Promise<void> => {
    if (!group) return
    setSaving(true)
    try {
      await updateTagGroupPattern(group.id, matchPattern)
      setEditingPattern(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!group) return
    setSaving(true)
    try {
      await deleteTagGroup(group.id)
      setConfirmingDelete(false)
    } finally {
      setSaving(false)
    }
  }

  const control = (
    <Accordion.Control
      ref={ref}
      bg={isOver ? 'var(--mantine-primary-color-light)' : activeHoverBackground(false, hovered)}
      bd={isOver ? '2px dashed var(--mantine-primary-color-filled)' : undefined}
    >
      {/* <Group justify="space-between" wrap="nowrap" pr="xs"> */}
      <Text truncate="end">{group?.name ?? 'Other Tags'}</Text>
      {/* </Group> */}
    </Accordion.Control>
  )

  return (
    <Accordion.Item value={group?.id ?? '__other__'}>
      {group ? (
        <TagGroupContextMenu
          onRename={() => setRenaming(true)}
          onEditPattern={() => setEditingPattern(true)}
          onDelete={() => setConfirmingDelete(true)}
        >
          {control}
        </TagGroupContextMenu>
      ) : (
        control
      )}
      <Accordion.Panel styles={{ content: { paddingLeft: 0 } }}>{renderTags(tags)}</Accordion.Panel>
      {/* Same mount-only-while-open reasoning as TagListItem's dialogs. */}
      {group && renaming && (
        <TagGroupNameDialog
          title="Rename tag group"
          confirmLabel="Rename"
          opened
          saving={saving}
          initialName={group.name}
          existingNames={existingGroupNames}
          onConfirm={(name) => void handleRename(name)}
          onCancel={() => setRenaming(false)}
        />
      )}
      {group && editingPattern && (
        <TagGroupPatternDialog
          opened
          saving={saving}
          initialMatchPattern={group.matchPattern}
          onConfirm={(matchPattern) => void handleEditPattern(matchPattern)}
          onCancel={() => setEditingPattern(false)}
        />
      )}
      {group && confirmingDelete && (
        <TagGroupDeleteDialog
          name={group.name}
          opened
          saving={saving}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </Accordion.Item>
  )
}

interface TagPanelProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

// Memoized so a re-render of its parent (e.g. NavbarSplitter during a
// Splitter drag) doesn't force this whole panel to re-render when its own
// props (collapsed/onToggleCollapse) haven't changed.
export const TagPanel = memo(function TagPanel({
  collapsed,
  onToggleCollapse
}: TagPanelProps = {}): ReactElement {
  const { allTags, tagCounts, tagCoverPhotos, state } = useSidebarLibrary()
  const { setTagFilter, renameTag, deleteTag } = useLibraryActions()
  const [editingTag, setEditingTag] = useState<string | null>(null)
  // Single stable reference (not one closure per tag per render) so
  // TagListItem's React.memo can bail out — see onSelect/onStartEdit below.
  const handleStopEdit = useCallback(() => setEditingTag(null), [])

  if (allTags.length === 0) {
    return (
      <Box p="lg">
        <Text c="dimmed">No tags yet.</Text>
      </Box>
    )
  }

  const renderTagRow = (tag: string): ReactElement => {
    const isActive = state.selectedTag === tag
    return (
      <TagListItem
        key={tag}
        tag={tag}
        count={tagCounts.get(tag) ?? 0}
        description={state.tagDescriptions.get(tag) ?? ''}
        coverPhoto={tagCoverPhotos.get(tag)}
        isActive={isActive}
        editing={editingTag === tag}
        draggable={state.tagGroups.length > 0}
        onSelect={setTagFilter}
        onStartEdit={setEditingTag}
        onStopEdit={handleStopEdit}
        onRename={renameTag}
        onDelete={deleteTag}
      />
    )
  }

  const renderTagTile = (tag: string): ReactElement => {
    const isActive = state.selectedTag === tag
    return (
      <TagGridTile
        key={tag}
        tag={tag}
        count={tagCounts.get(tag) ?? 0}
        coverPhoto={tagCoverPhotos.get(tag)}
        isActive={isActive}
        draggable={state.tagGroups.length > 0}
        onSelect={() => setTagFilter(isActive ? null : tag)}
      />
    )
  }

  const renderTags = (tags: string[]): ReactElement =>
    state.tagsPanelGridView ? (
      <SimpleGrid cols={2} spacing="xs" p="xs">
        {tags.map(renderTagTile)}
      </SimpleGrid>
    ) : (
      <Stack gap={0}>{tags.map(renderTagRow)}</Stack>
    )

  const headerAction = (
    <Group gap={4} wrap="nowrap">
      <TagGroupCreateButton />
      <TagsSettingsMenu />
    </Group>
  )

  if (state.tagGroups.length === 0) {
    return (
      <PanelSection
        title="Tags"
        headerAction={headerAction}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      >
        {renderTags(allTags)}
      </PanelSection>
    )
  }

  const otherTags = allTags.filter((tag) => !state.tagGroupAssignments.has(tag))
  const existingGroupNames = state.tagGroups.map((group) => group.name)

  return (
    <PanelSection
      title="Tags"
      headerAction={headerAction}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <Accordion multiple defaultValue={[...state.tagGroups.map((group) => group.id), '__other__']}>
        {state.tagGroups.map((group) => (
          <TagGroupSection
            key={group.id}
            group={group}
            tags={allTags.filter((tag) => state.tagGroupAssignments.get(tag) === group.id)}
            existingGroupNames={existingGroupNames.filter((name) => name !== group.name)}
            renderTags={renderTags}
          />
        ))}
        <TagGroupSection
          group={null}
          tags={otherTags}
          existingGroupNames={existingGroupNames}
          renderTags={renderTags}
        />
      </Accordion>
    </PanelSection>
  )
})
