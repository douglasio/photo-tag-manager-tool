import { type ReactElement, useState } from 'react'

import { Center, Stack, Text } from '@mantine/core'

import { usePhotoLibrary } from '@state'

import { DetailPanelComment } from './DetailPanelComment'
import { DetailPanelHeader } from './DetailPanelHeader'
import { DetailPanelMetadata } from './DetailPanelMetadata'
import { DetailPanelQuickTag } from './DetailPanelQuickTag'
import { DetailPanelTags } from './DetailPanelTags'

export function DetailPanel(): ReactElement {
  const { selectedPhoto, state } = usePhotoLibrary()
  // Deliberately not reset when selectedPhoto changes — staying open across
  // photo switches is the point (quickly tag several photos in a row without
  // reopening it each time), per the roadmap's "remain in this view until I
  // manually close" spec.
  const [quickTagOpen, setQuickTagOpen] = useState(false)

  // Showing one photo's metadata/tags while a multi-selection is active
  // would misleadingly suggest edits apply to just that one photo (batch
  // edits go through the gallery's right-click menu instead), so this stays
  // blank whenever more than one photo is selected — but only on the gallery
  // screen; a photo-view tab always has exactly one photo open regardless of
  // whatever multi-selection is lingering in the background gallery.
  if (state.activeTab === 'gallery' && state.selectedPaths.size > 1) {
    return (
      <Center h="100%">
        <Text c="dimmed" ta="center">
          {state.selectedPaths.size} photos selected
        </Text>
      </Center>
    )
  }

  if (!selectedPhoto) {
    return (
      <Center h="100%">
        <Text c="dimmed" ta="center">
          Select a photo
        </Text>
      </Center>
    )
  }

  if (quickTagOpen) {
    return (
      <Stack>
        <DetailPanelQuickTag photo={selectedPhoto} onClose={() => setQuickTagOpen(false)} />
      </Stack>
    )
  }

  return (
    <Stack>
      <DetailPanelHeader photo={selectedPhoto} />
      <DetailPanelComment photo={selectedPhoto} />
      <DetailPanelTags photo={selectedPhoto} onOpenQuickTag={() => setQuickTagOpen(true)} />
      <DetailPanelMetadata photo={selectedPhoto} />
    </Stack>
  )
}
