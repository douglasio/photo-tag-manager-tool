import { type ReactElement, useState } from 'react'

import { useDroppable } from '@dnd-kit/core'
import {
  ActionIcon,
  AspectRatio,
  Badge,
  Button,
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
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { activeHoverBackground, PREVIEW_TRIGGER_KEY } from '@utils'

import { TagContextMenu } from './TagContextMenu'
import { TagRenameDialog } from './TagRenameDialog'

const COVER_SIZE = 28

interface TagListItemProps {
  tag: string
  count: number
  description: string
  coverPhoto: PhotoRecord | undefined
  isActive: boolean
  editing: boolean
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
  onSelect,
  onStartEdit,
  onStopEdit,
  onRename
}: TagListItemProps): ReactElement {
  const { hovered, ref: hoverRef } = useHover<HTMLButtonElement>()
  const { isOver, setNodeRef } = useDroppable({ id: `tag:${tag}`, data: { tag } })
  const ref = useMergedRef(hoverRef, setNodeRef)

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

export function TagPanel(): ReactElement {
  const { allTags, tagCounts, tagCoverPhotos, state, setTagFilter, renameTag } = usePhotoLibrary()
  const [editingTag, setEditingTag] = useState<string | null>(null)

  if (allTags.length === 0) {
    return <Text c="dimmed">No tags yet.</Text>
  }

  return (
    <Stack gap={0}>
      {allTags.map((tag) => {
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
            onSelect={() => setTagFilter(isActive ? null : tag)}
            onStartEdit={() => setEditingTag(tag)}
            onStopEdit={() => setEditingTag(null)}
            onRename={(newTag) => renameTag(tag, newTag)}
          />
        )
      })}
    </Stack>
  )
}
