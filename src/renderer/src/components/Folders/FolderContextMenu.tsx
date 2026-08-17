import { Menu } from '@mantine/core'
import { IconEdit, IconEyeOff, IconEyeUp, IconFolderOpen } from '@tabler/icons-react'
import type { ReactElement, ReactNode } from 'react'

import { useLibraryActions, useSidebarLibrary } from '@state'
import { isMac, isPathUnderOrEqual } from '@utils'

interface FolderContextMenuProps {
  folderPath: string
  onRename: () => void
  children: ReactNode
}

export function FolderContextMenu({
  folderPath,
  onRename,
  children
}: FolderContextMenuProps): ReactElement {
  const { state } = useSidebarLibrary()
  const { excludeFolder, includeFolder } = useLibraryActions()
  const isExcluded = state.excludedFolders.some((folder) => isPathUnderOrEqual(folderPath, folder))

  return (
    <Menu shadow="md" width={200}>
      <Menu.ContextMenu>{children}</Menu.ContextMenu>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconFolderOpen size={14} />}
          onClick={() => window.api.showItemInFolder(folderPath)}
        >
          Show in {isMac ? 'Finder' : 'Explorer'}
        </Menu.Item>
        <Menu.Item leftSection={<IconEdit size={14} />} onClick={onRename}>
          Rename
        </Menu.Item>
        {isExcluded ? (
          <Menu.Item
            leftSection={<IconEyeUp size={14} />}
            onClick={() => void includeFolder(folderPath)}
          >
            Include in features
          </Menu.Item>
        ) : (
          <Menu.Item
            leftSection={<IconEyeOff size={14} />}
            onClick={() => void excludeFolder(folderPath)}
          >
            Exclude from features
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
