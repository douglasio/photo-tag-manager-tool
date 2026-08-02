import { type ReactElement, useState } from 'react'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  Accordion,
  ActionIcon,
  AspectRatio,
  Badge,
  Button,
  Group,
  Image,
  Stack,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core'
import { useHover, useMergedRef } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconPencil } from '@tabler/icons-react'

import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord, TagGroup } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { activeHoverBackground, PREVIEW_TRIGGER_KEY } from '@utils'

import { TagContextMenu } from './TagContextMenu'
import { TagGroupContextMenu } from './TagGroupContextMenu'
import { TagGroupDeleteDialog } from './TagGroupDeleteDialog'
import { TagGroupNameDialog } from './TagGroupNameDialog'
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
  onSelect: () => void
  onStartEdit: () => void
  onStopEdit: () => void
  onRename: (newTag: string) => Promise<void>
}

function TagListItem({
  tag,
  count,
  description,
  coverPhoto,
  isActive,
  editing,
  draggable,
  onSelect,
  onStartEdit,
  onStopEdit,
  onRename
}: TagListItemProps): ReactElement {
  const { hovered, ref: hoverRef } = useHover<HTMLButtonElement>()
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: `tag:${tag}`, data: { tag } })
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
  const ref = useMergedRef(hoverRef, setDropRef, setDragRef)

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
      await onRename(trimmed)
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

  return (
    <>
      <TagContextMenu onRename={onStartEdit}>
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
            onSelect()
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
                      onStartEdit()
                    }}
                    aria-label={`Rename #${tag}`}
                  >
                    <IconPencil />
                  </ActionIcon>
                </Tooltip>
              )}
              <Badge
                circle
                size="lg"
                variant={isActive ? 'filled' : 'light'}
                style={{ flexShrink: 0 }}
              >
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
            <Text display="block" lh="1" ta="left" truncate="end">
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
      <TagRenameDialog
        oldTag={tag}
        newTag={trimmed}
        count={count}
        opened={confirming}
        saving={saving}
        onConfirm={() => void handleConfirm()}
        onCancel={handleCancelConfirm}
      />
    </>
  )
}

interface TagGroupSectionProps {
  // null renders the synthetic "Other Tags" section — no rename/delete,
  // never removed itself, just whatever isn't in a real group.
  group: TagGroup | null
  tags: string[]
  existingGroupNames: string[]
  renderTagRow: (tag: string) => ReactElement
}

function TagGroupSection({
  group,
  tags,
  existingGroupNames,
  renderTagRow
}: TagGroupSectionProps): ReactElement {
  const { renameTagGroup, deleteTagGroup } = usePhotoLibrary()
  const { hovered, ref: hoverRef } = useHover<HTMLButtonElement>()
  const { isOver, setNodeRef } = useDroppable({
    id: `group:${group?.id ?? 'other'}`,
    data: { groupId: group?.id ?? null }
  })
  const ref = useMergedRef(hoverRef, setNodeRef)

  const [renaming, setRenaming] = useState(false)
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
      <Group justify="space-between" wrap="nowrap" pr="xs">
        <Text truncate="end">{group?.name ?? 'Other Tags'}</Text>
        <Badge variant="light" style={{ flexShrink: 0 }}>
          {tags.length}
        </Badge>
      </Group>
    </Accordion.Control>
  )

  return (
    <Accordion.Item value={group?.id ?? '__other__'}>
      {group ? (
        <TagGroupContextMenu
          onRename={() => setRenaming(true)}
          onDelete={() => setConfirmingDelete(true)}
        >
          {control}
        </TagGroupContextMenu>
      ) : (
        control
      )}
      <Accordion.Panel>
        <Stack gap={0}>{tags.map(renderTagRow)}</Stack>
      </Accordion.Panel>
      {group && (
        <>
          <TagGroupNameDialog
            title="Rename tag group"
            confirmLabel="Rename"
            opened={renaming}
            saving={saving}
            initialName={group.name}
            existingNames={existingGroupNames}
            onConfirm={(name) => void handleRename(name)}
            onCancel={() => setRenaming(false)}
          />
          <TagGroupDeleteDialog
            name={group.name}
            opened={confirmingDelete}
            saving={saving}
            onConfirm={() => void handleDelete()}
            onCancel={() => setConfirmingDelete(false)}
          />
        </>
      )}
    </Accordion.Item>
  )
}

export function TagPanel(): ReactElement {
  const { allTags, tagCounts, tagCoverPhotos, state, setTagFilter, renameTag } = usePhotoLibrary()
  const [editingTag, setEditingTag] = useState<string | null>(null)

  if (allTags.length === 0) {
    return <Text c="dimmed">No tags yet.</Text>
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
        onSelect={() => setTagFilter(isActive ? null : tag)}
        onStartEdit={() => setEditingTag(tag)}
        onStopEdit={() => setEditingTag(null)}
        onRename={(newTag) => renameTag(tag, newTag)}
      />
    )
  }

  if (state.tagGroups.length === 0) {
    return <Stack gap={0}>{allTags.map(renderTagRow)}</Stack>
  }

  const otherTags = allTags.filter((tag) => !state.tagGroupAssignments.has(tag))
  const existingGroupNames = state.tagGroups.map((group) => group.name)

  return (
    <Accordion
      multiple
      variant="separated"
      defaultValue={[...state.tagGroups.map((group) => group.id), '__other__']}
    >
      {state.tagGroups.map((group) => (
        <TagGroupSection
          key={group.id}
          group={group}
          tags={allTags.filter((tag) => state.tagGroupAssignments.get(tag) === group.id)}
          existingGroupNames={existingGroupNames.filter((name) => name !== group.name)}
          renderTagRow={renderTagRow}
        />
      ))}
      <TagGroupSection
        group={null}
        tags={otherTags}
        existingGroupNames={existingGroupNames}
        renderTagRow={renderTagRow}
      />
    </Accordion>
  )
}
