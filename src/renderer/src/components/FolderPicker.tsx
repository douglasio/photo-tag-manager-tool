import { Button, Group, Text } from '@mantine/core'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'

export function FolderPicker(): ReactElement {
  const { pickFolderAndScan, state } = usePhotoLibrary()

  return (
    <Group gap="sm" wrap="nowrap">
      <Button
        onClick={() => void pickFolderAndScan()}
        disabled={state.status === 'scanning'}
        loading={state.status === 'scanning'}
      >
        Select Folder…
      </Button>
      {state.rootPath && (
        <Text c="dimmed" truncate="end" maw={320}>
          {state.rootPath}
        </Text>
      )}
    </Group>
  )
}
