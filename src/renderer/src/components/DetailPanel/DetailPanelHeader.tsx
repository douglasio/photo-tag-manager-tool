import { type ReactElement, useState } from 'react'

import { Box, Button, Group, RollingNumber, Stack, Tooltip } from '@mantine/core'
import { IconEye, IconPhoto } from '@tabler/icons-react'

import { FileNameField } from '@components'
import { type DisplayPhotoRecord, usePhotoLibrary } from '@state'

interface DetailPanelHeaderProps {
  photo: DisplayPhotoRecord
}

/** Open button, editable filename, and view count — the top of the detail panel. */
export function DetailPanelHeader({ photo }: DetailPanelHeaderProps): ReactElement {
  const { state, openPhotoTab, renameFile } = usePhotoLibrary()
  const [editingFileName, setEditingFileName] = useState(false)

  // The panel is already showing this exact photo's details because it's
  // the open photo-view tab — opening it again would be a no-op, so the
  // button is redundant there (it stays for the gallery screen, where the
  // photo is just the selection cursor, not necessarily open yet).
  const isViewingThisPhoto = state.activeTab === photo.filePath

  return (
    <Stack>
      {!isViewingThisPhoto && (
        <Tooltip label="Open">
          <Button
            leftSection={<IconPhoto size={18} />}
            onClick={() => openPhotoTab(photo.filePath)}
          >
            Open
          </Button>
        </Tooltip>
      )}
      <Box flex={1} miw={0}>
        <FileNameField
          fileName={photo.fileName}
          editing={editingFileName}
          onStartEdit={() => setEditingFileName(true)}
          onStopEdit={() => setEditingFileName(false)}
          onRename={(newBaseName) => renameFile(photo.filePath, newBaseName)}
          variant="panel"
        />
      </Box>
      <Group gap={4} c="dimmed">
        <IconEye size={16} />
        <RollingNumber
          value={photo.viewCount}
          prefix="Viewed "
          suffix={photo.viewCount === 1 ? ' time' : ' times'}
          fz="sm"
        />
      </Group>
    </Stack>
  )
}
