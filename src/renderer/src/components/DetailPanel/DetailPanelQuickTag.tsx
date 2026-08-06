import { ActionIcon, Chip, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { SectionTitle } from '@components'
import { type DisplayPhotoRecord, usePhotoLibrary } from '@state'

interface DetailPanelQuickTagProps {
  photo: DisplayPhotoRecord
  onClose: () => void
}

// Full-panel takeover for rapidly toggling tags on the current photo — all
// known tags as Chips, already-applied ones pre-checked. Chip.Group's own
// multiple-select value/onChange already hands back the full desired tags
// array, so each toggle is just a direct updateTags call, same contract as
// TagList's onChange.
export function DetailPanelQuickTag({ photo, onClose }: DetailPanelQuickTagProps): ReactElement {
  const { allTags, updateTags } = usePhotoLibrary()

  return (
    <Stack>
      <Group justify="space-between" wrap="nowrap">
        <SectionTitle>Quick Tag</SectionTitle>
        <Tooltip label="Close quick tag">
          <ActionIcon variant="subtle" onClick={onClose} aria-label="Close quick tag">
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {allTags.length === 0 ? (
        <Text c="dimmed" size="sm">
          No tags yet — add one from the Tags panel first.
        </Text>
      ) : (
        <Chip.Group
          multiple
          value={photo.tags}
          onChange={(tags) => void updateTags(photo.filePath, tags)}
        >
          <Group gap="xs">
            {allTags.map((tag) => (
              <Chip key={tag} value={tag}>
                {tag}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      )}
    </Stack>
  )
}
