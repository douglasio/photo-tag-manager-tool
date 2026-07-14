import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
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
import { useState, useMemo, type ReactElement, type ReactNode } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { foldersToTreeData } from '../utils/folderTree'
import { splitFolderPath, validateFolderNameBase } from '../utils/folderNameValidation'
import { activeHoverBackground } from '../utils/listItemStyles'

interface ExpandToggleProps {
  hasChildren: boolean
  expanded: boolean
  onToggle: () => void
}

function ExpandToggle({ hasChildren, expanded, onToggle }: ExpandToggleProps): ReactElement {
  const theme = useMantineTheme()
  const { hovered, ref } = useHover<HTMLDivElement>()

  return (
    <Box
      ref={ref}
      w="md"
      c="dimmed"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: hasChildren ? 'pointer' : undefined,
        borderRadius: '50%',
        backgroundColor: hasChildren && hovered ? 'var(--mantine-color-default-hover)' : undefined
      }}
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
    </Box>
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
  const { hovered, ref } = useHover<HTMLDivElement>()
  const { onClick, style, ...restProps } = elementProps
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
    <Group gap={0} wrap="nowrap" ref={ref} bg={activeHoverBackground(isActive, hovered)}>
      <Button
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
        flex="1"
        miw="0"
        variant="transparent"
        justify="left"
        leftSection={
          <ExpandToggle
            hasChildren={hasChildren}
            expanded={expanded}
            onToggle={() => onToggleExpand(node.value)}
          />
        }
      >
        <Group {...restProps} gap={6} wrap="nowrap" p={4}>
          {editing ? (
            <TextInput
              autoFocus
              variant="unstyled"
              value={draft}
              error={error}
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
              style={{ flex: 1, minWidth: 0 }}
              styles={{ input: { padding: 0, height: 'auto', minHeight: 'auto' } }}
            />
          ) : (
            <>
              <Text truncate="end" miw={0} flex="1">
                {node.label}
              </Text>
              <FolderBadge isActive={isActive}>{fileCount}</FolderBadge>
            </>
          )}
        </Group>
      </Button>
      {!editing && (
        <Tooltip label="Rename folder">
          <ActionIcon
            style={{ opacity: hovered ? 0.7 : 0, flexShrink: 0 }}
            onClick={(event) => {
              event.stopPropagation()
              onStartEdit()
            }}
            aria-label={`Rename ${node.value}`}
          >
            <IconPencil size={14} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
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

function FolderBadge({
  isActive,
  children
}: {
  isActive: boolean
  children: ReactNode
}): ReactElement {
  return (
    <Badge
      circle
      variant={isActive ? 'filled' : 'transparent'}
      color={isActive ? undefined : 'gray'}
    >
      {children}
    </Badge>
  )
}

function AllPhotosRow({
  isActive,
  count,
  onClick
}: {
  isActive: boolean
  count: number
  onClick: () => void
}): ReactElement {
  const { hovered, ref } = useHover<HTMLButtonElement>()

  return (
    <Button
      ref={ref}
      onClick={onClick}
      bg={activeHoverBackground(isActive, hovered)}
      w="100%"
      variant="transparent"
      justify="left"
      leftSection={<Box w="md" style={{ flexShrink: 0 }} />}
    >
      <Group gap={6} wrap="nowrap" p={4}>
        <Text truncate="end" miw={0} flex="1">
          All Photos
        </Text>
        <FolderBadge isActive={isActive}>{count}</FolderBadge>
      </Group>
    </Button>
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
      <AllPhotosRow
        isActive={state.selectedFolder === null && state.selectedTag === null}
        count={state.photosByPath.size}
        onClick={() => setFolderFilter(null)}
      />
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
