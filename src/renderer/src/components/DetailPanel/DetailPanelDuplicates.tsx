import { type ReactElement, useEffect, useState } from 'react'

import { Group, Image, Stack } from '@mantine/core'
import { IconStack2 } from '@tabler/icons-react'

import { SectionTitle } from '@components'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { SimilarPhoto } from '@shared/types'
import { type DisplayPhotoRecord, usePhotoLibrary } from '@state'

const MAX_MATCHES = 5
const THUMB_SIZE = 64

interface DetailPanelDuplicatesProps {
  photo: DisplayPhotoRecord
}

// Hints at near-duplicates of the current photo, comparing against whatever
// embeddings are already cached (see duplicatePhotoService.findSimilarPhotos)
// — embeds this one photo on demand if it's missing an embedding, but never
// triggers a full-library scan. Renders nothing once there's nothing found.
export function DetailPanelDuplicates({ photo }: DetailPanelDuplicatesProps): ReactElement | null {
  const { state, findSimilarPhotos, openPhotoTab } = usePhotoLibrary()
  const [matches, setMatches] = useState<SimilarPhoto[]>([])

  // Adjust-during-render (not inside the effect below) the instant the
  // photo changes — same pattern useTagSuggestions uses to reset state
  // synchronously without triggering the set-state-in-effect lint rule.
  const [trackedPath, setTrackedPath] = useState(photo.filePath)
  if (trackedPath !== photo.filePath) {
    setTrackedPath(photo.filePath)
    setMatches([])
  }

  useEffect(() => {
    let cancelled = false
    findSimilarPhotos(photo.filePath, MAX_MATCHES)
      .then((results) => {
        if (!cancelled) setMatches(results)
      })
      .catch((err: unknown) => {
        console.error(`failed to find similar photos for ${photo.filePath}`, err)
      })
    return () => {
      cancelled = true
    }
  }, [photo.filePath, findSimilarPhotos])

  if (matches.length === 0) return null

  return (
    <Stack gap="xs">
      <SectionTitle icon={IconStack2}>Potential Duplicates</SectionTitle>
      <Group gap="xs">
        {matches.map((match) => {
          const matchPhoto = state.photosByPath.get(match.filePath)
          if (!matchPhoto?.thumbnailKey) return null
          return (
            <Image
              key={match.filePath}
              src={toThumbProtocolUrl(matchPhoto.thumbnailKey)}
              alt={matchPhoto.fileName}
              w={THUMB_SIZE}
              h={THUMB_SIZE}
              fit="cover"
              radius="sm"
              style={{ cursor: 'pointer' }}
              onClick={() => openPhotoTab(match.filePath)}
            />
          )
        })}
      </Group>
    </Stack>
  )
}
