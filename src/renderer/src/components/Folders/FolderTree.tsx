import { memo, type ReactElement, useMemo, useState } from 'react'

import { useDroppable } from '@dnd-kit/core'
import {
  ActionIcon,
  Box,
  Button,
  type RenderTreeNodePayload,
  Stack,
  Text,
  TextInput,
  Tooltip,
  Tree,
  type TreeNodeData,
  useTree
} from '@mantine/core'
import { useHover, useMergedRef } from '@mantine/hooks'
import { IconChevronDown, IconChevronRight, IconEyeOff, IconPencil } from '@tabler/icons-react'

import { FolderSettingsMenu, PanelSection } from '@components'
import { useLibraryActions, useSidebarLibrary } from '@state'
import {
  activeHoverBackground,
  foldersToTreeData,
  foldersToTreeDataWithEmpty,
  isPathUnderOrEqual,
  PREVIEW_TRIGGER_KEY,
  splitFolderPath,
  validateFolderNameBase
} from '@utils'

import { FolderBadge } from './FolderBadge'
import { FolderContextMenu } from './FolderContextMenu'

interface ExpandToggleProps {
  hasChildren: boolean
  expanded: boolean
  onToggle: () => void
}

function ExpandToggle({ hasChildren, expanded, onToggle }: ExpandToggleProps): ReactElement {
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
      {hasChildren && (expanded ? <IconChevronDown /> : <IconChevronRight />)}
    </ActionIcon>
  )
}

interface TreeRowProps {
  payload: RenderTreeNodePayload
  isActive: boolean
  editing: boolean
  isExcluded: boolean
  onStartEdit: (folder: string) => void
  onStopEdit: () => void
  onRenameFolder: (folder: string, newBaseName: string) => Promise<void>
  onSelect: (value: string | null) => void
  onToggleExpand: (value: string) => void
}

// No usePhotoLibrary()/context subscription of its own — isExcluded is
// computed once by the parent (FolderTreeInner) and handlers are passed
// through unbound (rather than each renderNode call wrapping them in a new
// per-node closure), so this row's props stay reference-stable across a
// render that doesn't actually affect it, letting React.memo below bail out.
const TreeRow = memo(function TreeRow({
  payload,
  isActive,
  editing,
  isExcluded,
  onStartEdit,
  onStopEdit,
  onRenameFolder,
  onSelect,
  onToggleExpand
}: TreeRowProps): ReactElement {
  const { node, expanded, hasChildren, elementProps } = payload
  const { hovered, ref: hoverRef } = useHover<HTMLButtonElement>()
  const { isOver, setNodeRef } = useDroppable({
    id: `folder:${node.value}`,
    data: { folderPath: node.value }
  })
  const ref = useMergedRef(hoverRef, setNodeRef)
  const { onClick, style } = elementProps
  const fileCount = (node.nodeProps as { fileCount?: number } | undefined)?.fileCount ?? 0

  const { base } = splitFolderPath(node.value)
  const [draft, setDraft] = useState(base)
  // Adjust-during-render reset (not a useEffect) for when editing is
  // triggered externally by the pencil icon rather than by this row itself —
  // same pattern used by FileNameField for the gallery's rename flow.
  const [wasEditing, setWasEditing] = useState(editing)
  if (editing !== wasEditing) {
    setWasEditing(editing)
    if (editing) setDraft(base)
  }

  const error = validateFolderNameBase(draft)

  const commit = (): void => {
    if (error) return
    onStopEdit()
    if (draft.trim() !== base) void onRenameFolder(node.value, draft.trim())
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
    <FolderContextMenu folderPath={node.value} onRename={() => onStartEdit(node.value)}>
      <Button
        ref={ref}
        bg={
          isOver ? 'var(--mantine-primary-color-light)' : activeHoverBackground(isActive, hovered)
        }
        onClick={(event) => {
          if (editing) return
          onClick(event)
          onSelect(node.value)
        }}
        onDoubleClick={() => {
          if (editing || !hasChildren) return
          onToggleExpand(node.value)
        }}
        style={{
          ...style,
          paddingInlineStart: 'var(--label-offset)',
          outline: isOver ? '2px dashed var(--mantine-primary-color-filled)' : undefined,
          outlineOffset: -2
        }}
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
              {isExcluded && (
                <Tooltip label="Excluded from features">
                  <IconEyeOff
                    size={14}
                    style={{ flexShrink: 0 }}
                    color="var(--mantine-color-dimmed)"
                  />
                </Tooltip>
              )}
              <Tooltip label="Rename folder">
                <ActionIcon
                  opacity={hovered ? 0.7 : 0}
                  style={{ flexShrink: 0 }}
                  onClick={(event) => {
                    event.stopPropagation()
                    onStartEdit(node.value)
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
          <Tooltip label={node.label} openDelay={700}>
            <Text truncate="end">{node.label}</Text>
          </Tooltip>
        )}
      </Button>
    </FolderContextMenu>
  )
})

interface FolderTreeInnerProps {
  rootPath: string
  folderCounts: Map<string, number>
  folderChildren: Map<string, Set<string>>
  allFolderPaths: Set<string>
  showEmptyFolders: boolean
  selectedFolder: string | null
  excludedFolders: string[]
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
  allFolderPaths,
  showEmptyFolders,
  selectedFolder,
  excludedFolders,
  setFolderFilter,
  editingFolder,
  onStartEdit,
  onStopEdit,
  onRenameFolder
}: FolderTreeInnerProps): ReactElement {
  const treeData = useMemo<TreeNodeData[]>(
    () => [
      showEmptyFolders
        ? foldersToTreeDataWithEmpty(rootPath, allFolderPaths, folderCounts)
        : foldersToTreeData(rootPath, folderCounts, folderChildren)
    ],
    [rootPath, folderCounts, folderChildren, allFolderPaths, showEmptyFolders]
  )

  const tree = useTree({
    initialExpandedState: { [rootPath]: true }
  })

  return (
    <Tree
      data={treeData}
      tree={tree}
      expandOnClick={false}
      // Otherwise Mantine's Tree swallows Space (stopPropagation, to
      // expand/collapse the focused node) before it ever reaches the
      // window-level listener the gallery's preview-trigger key relies on —
      // expand/collapse already has the chevron button and double-click.
      expandOnSpace={false}
      // expandOnSpace above also drops Tree's own preventDefault for Space,
      // so redo just that part ourselves — otherwise a focused tree row
      // scrolls the sidebar (the browser's native Space behavior) while the
      // user is just holding it to preview a gallery thumbnail.
      onKeyDown={(event) => {
        if (event.key === PREVIEW_TRIGGER_KEY) event.preventDefault()
      }}
      renderNode={(payload) => (
        <TreeRow
          payload={payload}
          isActive={selectedFolder !== null && payload.node.value === selectedFolder}
          editing={editingFolder === payload.node.value}
          isExcluded={excludedFolders.some((folder) =>
            isPathUnderOrEqual(payload.node.value, folder)
          )}
          onStartEdit={onStartEdit}
          onStopEdit={onStopEdit}
          onRenameFolder={onRenameFolder}
          onSelect={setFolderFilter}
          onToggleExpand={tree.toggleExpanded}
        />
      )}
    />
  )
}

interface FolderTreeProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

// Memoized so a re-render of its parent (e.g. NavbarSplitter during a
// Splitter drag) doesn't force this whole panel to re-render when its own
// props (collapsed/onToggleCollapse) haven't changed — it still re-renders
// normally when its own useSidebarLibrary()/useLibraryActions() data does.
export const FolderTree = memo(function FolderTree({
  collapsed,
  onToggleCollapse
}: FolderTreeProps = {}): ReactElement {
  const { state } = useSidebarLibrary()
  const { setFolderFilter, renameFolder } = useLibraryActions()
  const [editingFolder, setEditingFolder] = useState<string | null>(null)

  if (state.folders.length === 0) {
    return (
      <Box p="lg">
        <Text c="dimmed">No folders yet.</Text>
      </Box>
    )
  }

  return (
    <PanelSection
      title="Folders"
      headerAction={<FolderSettingsMenu />}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <Stack gap="md">
        {state.folders.map((folder) => (
          <FolderTreeInner
            key={folder}
            rootPath={folder}
            folderCounts={state.folderCounts}
            folderChildren={state.folderChildren}
            allFolderPaths={state.allFolderPaths}
            showEmptyFolders={state.showEmptyFolders}
            selectedFolder={state.selectedFolder}
            excludedFolders={state.excludedFolders}
            setFolderFilter={setFolderFilter}
            editingFolder={editingFolder}
            onStartEdit={setEditingFolder}
            onStopEdit={() => setEditingFolder(null)}
            onRenameFolder={renameFolder}
          />
        ))}
      </Stack>
    </PanelSection>
  )
})
