import { Button, Chip, Group, Stack, Text } from '@mantine/core'
import { IconColumns2 } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { SectionTitle } from '@components'
import type { PhotoRecord } from '@shared/types'
import { MAX_COMPARE_PHOTOS, MIN_COMPARE_PHOTOS, usePhotoLibrary } from '@state'

import { DetailPanelTagChip } from './DetailPanelTagChip'

// Multi-select alternative to the single-photo DetailPanel — Compare, plus
// Quick Tag's same all-tags Chip.Group, checked only where every selected photo has the tag.
export function DetailPanelMultiSelect(): ReactElement {
  const { state, allTags, openCompareTab, addTagsToSelection, removeTagsFromSelection } =
    usePhotoLibrary()

  const selectedPaths = Array.from(state.selectedPaths)
  const selectedPhotos = selectedPaths
    .map((path) => state.photosByPath.get(path))
    .filter((photo): photo is PhotoRecord => photo != null)

  const checkedTags = allTags.filter((tag) =>
    selectedPhotos.every((photo) => photo.tags.includes(tag))
  )

  const handleChange = (nextTags: string[]): void => {
    const added = nextTags.filter((tag) => !checkedTags.includes(tag))
    const removed = checkedTags.filter((tag) => !nextTags.includes(tag))
    if (added.length > 0) void addTagsToSelection(added)
    if (removed.length > 0) void removeTagsFromSelection(removed)
  }

  return (
    <Stack>
      <Text c="dimmed" size="sm">
        {state.selectedPaths.size} photos selected
      </Text>

      {state.selectedPaths.size >= MIN_COMPARE_PHOTOS &&
        state.selectedPaths.size <= MAX_COMPARE_PHOTOS && (
          <Button
            variant="light"
            leftSection={<IconColumns2 size={16} />}
            onClick={() => openCompareTab(selectedPaths)}
          >
            Compare photos
          </Button>
        )}

      <Stack gap="xs">
        <SectionTitle>Tags</SectionTitle>
        {allTags.length === 0 ? (
          <Text c="dimmed" size="sm">
            No tags yet — add one from the Tags panel first.
          </Text>
        ) : (
          <Chip.Group multiple value={checkedTags} onChange={handleChange}>
            <Group gap="xs">
              {allTags.map((tag) => (
                <DetailPanelTagChip key={tag} tag={tag} checked={checkedTags.includes(tag)} />
              ))}
            </Group>
          </Chip.Group>
        )}
      </Stack>
    </Stack>
  )
}
