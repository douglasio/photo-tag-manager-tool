import { Badge, Group, Text, Tree, useTree, type TreeNodeData } from '@mantine/core'
import { useMemo, type ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { foldersToTreeData } from '../utils/folderTree'

interface FolderTreeInnerProps {
  rootPath: string
  folderCounts: Map<string, number>
  folderChildren: Map<string, Set<string>>
  setFolderFilter: (folder: string | null) => void
}

function FolderTreeInner({
  rootPath,
  folderCounts,
  folderChildren,
  setFolderFilter
}: FolderTreeInnerProps): ReactElement {
  const treeData = useMemo<TreeNodeData[]>(
    () => [foldersToTreeData(rootPath, folderCounts, folderChildren)],
    [rootPath, folderCounts, folderChildren]
  )

  const tree = useTree({
    initialSelectedState: [rootPath],
    initialExpandedState: { [rootPath]: true }
  })

  return (
    <Tree
      data={treeData}
      tree={tree}
      selectOnClick
      renderNode={({ node, expanded, hasChildren, selected, elementProps }) => {
        const { onClick, style, ...restProps } = elementProps
        const fileCount = (node.nodeProps as { fileCount?: number } | undefined)?.fileCount ?? 0
        return (
          <Group
            {...restProps}
            onClick={(event) => {
              onClick(event)
              setFolderFilter(node.value === rootPath ? null : node.value)
            }}
            style={{ ...style, cursor: 'pointer' }}
            gap={6}
            wrap="nowrap"
            p={4}
          >
            <Text size="lg" c="dimmed" w={12} ta="center" style={{ flexShrink: 0 }}>
              {hasChildren ? (expanded ? '▾' : '▸') : ''}
            </Text>
            <Text truncate="end" miw={0} style={{ flex: 1 }}>
              {node.label}
            </Text>
            <Badge variant={selected ? 'filled' : 'light'} color="indigo">
              {fileCount}
            </Badge>
          </Group>
        )
      }}
    />
  )
}

export function FolderTree(): ReactElement {
  const { state, setFolderFilter } = usePhotoLibrary()
  const rootPath = state.rootPath

  if (!rootPath) {
    return <Text c="dimmed">Select a folder to see its structure.</Text>
  }

  return (
    <FolderTreeInner
      key={rootPath}
      rootPath={rootPath}
      folderCounts={state.folderCounts}
      folderChildren={state.folderChildren}
      setFolderFilter={setFolderFilter}
    />
  )
}
