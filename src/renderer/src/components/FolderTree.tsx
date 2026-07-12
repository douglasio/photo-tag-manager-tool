import {
  Badge,
  Box,
  Button,
  Group,
  Stack,
  Text,
  Tree,
  useMantineTheme,
  useTree,
  type RenderTreeNodePayload,
  type TreeNodeData
} from '@mantine/core'
import { useHover } from '@mantine/hooks'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { useMemo, type ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { foldersToTreeData } from '../utils/folderTree'
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
  onSelect: (value: string) => void
  onToggleExpand: (value: string) => void
}

function TreeRow({ payload, isActive, onSelect, onToggleExpand }: TreeRowProps): ReactElement {
  const { node, expanded, hasChildren, elementProps } = payload
  const { hovered, ref } = useHover<HTMLDivElement>()
  const { onClick, style, ...restProps } = elementProps
  const fileCount = (node.nodeProps as { fileCount?: number } | undefined)?.fileCount ?? 0

  return (
    <Button
      onClick={(event) => {
        onClick(event)
        onSelect(node.value)
      }}
      onDoubleClick={() => {
        if (!hasChildren) return
        onToggleExpand(node.value)
      }}
      style={{
        ...style
      }}
      bg={activeHoverBackground(isActive, hovered)}
      w={'100%'}
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
      <Group
        {...restProps}
        ref={ref}

        gap={6}
        wrap="nowrap"
        p={4}
      >
        <Text truncate="end" miw={0} flex="1">
          {node.label}
        </Text>
        <Badge circle variant={isActive ? 'filled' : 'light'}>
          {fileCount}
        </Badge>
      </Group>
    </Button>
  )
}

interface FolderTreeInnerProps {
  rootPath: string
  folderCounts: Map<string, number>
  folderChildren: Map<string, Set<string>>
  selectedFolder: string | null
  setFolderFilter: (folder: string | null) => void
}

function FolderTreeInner({
  rootPath,
  folderCounts,
  folderChildren,
  selectedFolder,
  setFolderFilter
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
          onSelect={setFolderFilter}
          onToggleExpand={tree.toggleExpanded}
        />
      )}
    />
  )
}

function AllPhotosRow({
  isActive,
  onClick
}: {
  isActive: boolean
  onClick: () => void
}): ReactElement {
  const { hovered, ref } = useHover<HTMLButtonElement>()

  return (
    <Button
      ref={ref}
      onClick={onClick}
      bg={activeHoverBackground(isActive, hovered)}
      justify="left"
      variant="transparent"
      leftSection={' '}
    >
      <Text>All Photos</Text>
    </Button>
  )
}

export function FolderTree(): ReactElement {
  const { state, setFolderFilter } = usePhotoLibrary()

  if (state.folders.length === 0) {
    return <Text c="dimmed">Add a folder to see its structure.</Text>
  }

  return (
    <Stack gap="md">
      <AllPhotosRow
        isActive={state.selectedFolder === null && state.selectedTag === null}
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
        />
      ))}
    </Stack>
  )
}
