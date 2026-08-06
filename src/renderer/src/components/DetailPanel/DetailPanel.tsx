import { type ReactElement, useState } from 'react'

import { Center, Stack, Text } from '@mantine/core'

import { usePhotoLibrary } from '@state'

import { DetailPanelComment } from './DetailPanelComment'
import { DetailPanelHeader } from './DetailPanelHeader'
import { DetailPanelMetadata } from './DetailPanelMetadata'
import { DetailPanelMultiSelect } from './DetailPanelMultiSelect'
import { DetailPanelQuickTag } from './DetailPanelQuickTag'
import { DetailPanelTags } from './DetailPanelTags'

export function DetailPanel(): ReactElement {
  const { selectedPhoto, state } = usePhotoLibrary()
  // Deliberately not reset when selectedPhoto changes — staying open across
  // photo switches is the point (quickly tag several photos in a row without
  // reopening it each time), per the roadmap's "remain in this view until I
  // manually close" spec.
  const [quickTagOpen, setQuickTagOpen] = useState(false)

  // Single-photo editing (Header/Comment/Tags/Metadata) would misleadingly
  // suggest edits apply to just one photo, so a multi-selection gets its own
  // batch-oriented view instead — but only on the gallery screen; a
  // photo-view tab always has exactly one photo open regardless of whatever
  // multi-selection is lingering in the background gallery.
  if (state.activeTab === 'gallery' && state.selectedPaths.size > 1) {
    return <DetailPanelMultiSelect />
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
