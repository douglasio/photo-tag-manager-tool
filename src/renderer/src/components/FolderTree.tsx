import {
  ActionIcon,
  Button,
  Stack,
  Text,
  TextInput,
  Tooltip,
  Tree,
  useMantineTheme,
  useTree,
  type RenderTreeNodePayload,
  type TreeNodeData
} from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { IconChevronDown, IconChevronRight, IconPencil } from '@tabler/icons-react'
import { useState, useMemo, type ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { foldersToTreeData } from '../utils/folderTree'
import { splitFolderPath, validateFolderNameBase } from '../utils/folderNameValidation'
import { activeHoverBackground } from '../utils/listItemStyles'
import { FolderBadge } from './FolderBadge'

interface ExpandToggleProps {
  hasChildren: boolean
  expanded: boolean
  onToggle: () => void
}

function ExpandToggle({ hasChildren, expanded, onToggle }: ExpandToggleProps): ReactElement {
  const theme = useMantineTheme()
  const { ref } = useHover<HTMLButtonElement>()

  return (
    <ActionIcon
      ref={ref}
      c="dimmed"
      variant="transparent"
      onClick={(event) => {
        if (!hasChildren) return
        event.stopPropagation()
        onToggle()
      }}
    >
      {hasChildren &&
        (expanded ? (
          <IconChevronDown size={theme.spacing.sm} />
        ) : (
          <IconChevronRight size={theme.spacing.sm} />
        ))}
    </ActionIcon>
  )
}

interface TreeRowProps {
  payload: RenderTreeNodePayload
  isActive: boolean
  editing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
  onRenameFolder: (newBaseName: string) => Promise<void>
  onSelect: (value: string) => void
  onToggleExpand: (value: string) => void
}

function TreeRow({
  payload,
  isActive,
  editing,
  onStartEdit,
  onStopEdit,
  onRenameFolder,
  onSelect,
  onToggleExpand
}: TreeRowProps): ReactElement {
  const { node, expanded, hasChildren, elementProps } = payload
  const { hovered, ref } = useHover<HTMLButtonElement>()
  const { onClick, style } = elementProps
  const fileCount = (node.nodeProps as { fileCount?: number } | undefined)?.fileCount ?? 0

  const { base } = splitFolderPath(node.value)
  const [draft, setDraft] = useState(base)
  // Adjust-during-render reset (not a useEffect) for when editing is
  // triggered externally by the pencil icon rather than by this row itself —
  // same pattern used by GalleryFileName for the gallery's rename flow.
  const [wasEditing, setWasEditing] = useState(editing)
  if (editing !== wasEditing) {
    setWasEditing(editing)
    if (editing) setDraft(base)
  }

  const error = validateFolderNameBase(draft)

  const commit = (): void => {
    if (error) return
    onStopEdit()
    if (draft.trim() !== base) void onRenameFolder(draft.trim())
  }

  const cancel = (): void => {
    setDraft(base)
    onStopEdit()
  }

  // Edit mode reuses the exact same Button/leftSection/padding chrome as
  // view mode, only swapping Text for a TextInput as the button's content —
  // otherwise the differing padding/gap between a Button and a plain Group
  // shifts the row's font size and horizontal position when toggling.
  return (
    <Button
      ref={ref}
      bg={activeHoverBackground(isActive, hovered)}
      onClick={(event) => {
        if (editing) return
        onClick(event)
        onSelect(node.value)
      }}
      onDoubleClick={() => {
        if (editing || !hasChildren) return
        onToggleExpand(node.value)
      }}
      style={style}
      variant="transparent"
      justify="space-between"
      fullWidth
      // Button's "label" slot (wrapping children) shrink-wraps to its
      // content by default instead of growing to fill the space between
      // leftSection/rightSection — with justify="space-between" that leaves
      // the narrow label floating with roughly even gaps on both sides
      // (reads as centered) instead of hugging the left edge.
      styles={{ label: { flex: 1 } }}
      leftSection={
        <ExpandToggle
          hasChildren={hasChildren}
          expanded={expanded}
          onToggle={() => onToggleExpand(node.value)}
        />
      }
      rightSection={
        !editing && (
          <>
            <Tooltip label="Rename folder">
              <ActionIcon
                style={{ opacity: hovered ? 0.7 : 0, flexShrink: 0 }}
                onClick={(event) => {
                  event.stopPropagation()
                  onStartEdit()
                }}
                aria-label={`Rename ${node.value}`}
              >
                <IconPencil />
              </ActionIcon>
            </Tooltip>
            <FolderBadge isActive={isActive}>{fileCount}</FolderBadge>
          </>
        )
      }
    >
      {editing ? (
        <TextInput
          autoFocus
          variant="unstyled"
          value={draft}
          error={error}
          flex="1"
          miw="0"
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            // Mantine's Tree attaches its own keyboard-nav handler on the
            // <li role="treeitem"> ancestor — Space (expand/collapse) and
            // the arrow keys are intercepted there unconditionally, so
            // without stopping propagation here they'd never reach the
            // input (no spaces, no cursor movement) while renaming.
            event.stopPropagation()
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            } else if (event.key === 'Escape') {
              cancel()
            }
          }}
          styles={{ input: { padding: 0, height: 'auto', minHeight: 'auto' } }}
        />
      ) : (
        <Text truncate="end">{node.label}</Text>
      )}
    </Button>
  )
}

interface FolderTreeInnerProps {
  rootPath: string
  folderCounts: Map<string, number>
  folderChildren: Map<string, Set<string>>
  selectedFolder: string | null
  setFolderFilter: (folder: string | null) => void
  editingFolder: string | null
  onStartEdit: (folder: string) => void
  onStopEdit: () => void
  onRenameFolder: (folder: string, newBaseName: string) => Promise<void>
}

function FolderTreeInner({
  rootPath,
  folderCounts,
  folderChildren,
  selectedFolder,
  setFolderFilter,
  editingFolder,
  onStartEdit,
  onStopEdit,
  onRenameFolder
}: FolderTreeInnerProps): ReactElement {
  const treeData = useMemo<TreeNodeData[]>(
    () => [foldersToTreeData(rootPath, folderCounts, folderChildren)],
    [rootPath, folderCounts, folderChildren]
  )

  const tree = useTree({
    initialExpandedState: { [rootPath]: true }
  })

  return (
    <Tree
      data={treeData}
      tree={tree}
      expandOnClick={false}
      renderNode={(payload) => (
        <TreeRow
          payload={payload}
          isActive={selectedFolder !== null && payload.node.value === selectedFolder}
          editing={editingFolder === payload.node.value}
          onStartEdit={() => onStartEdit(payload.node.value)}
          onStopEdit={onStopEdit}
          onRenameFolder={(newBaseName) => onRenameFolder(payload.node.value, newBaseName)}
          onSelect={setFolderFilter}
          onToggleExpand={tree.toggleExpanded}
        />
      )}
    />
  )
}

export function FolderTree(): ReactElement {
  const { state, setFolderFilter, renameFolder } = usePhotoLibrary()
  const [editingFolder, setEditingFolder] = useState<string | null>(null)

  if (state.folders.length === 0) {
    return <Text c="dimmed">Add a folder to see its structure.</Text>
  }

  return (
    <Stack gap="md">
      {state.folders.map((folder) => (
        <FolderTreeInner
          key={folder}
          rootPath={folder}
          folderCounts={state.folderCounts}
          folderChildren={state.folderChildren}
          selectedFolder={state.selectedFolder}
          setFolderFilter={setFolderFilter}
          editingFolder={editingFolder}
          onStartEdit={setEditingFolder}
          onStopEdit={() => setEditingFolder(null)}
          onRenameFolder={renameFolder}
        />
      ))}
    </Stack>
  )
}
