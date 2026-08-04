import { type ReactElement, useState } from 'react'

import { Button, Group, Image, Stack, Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { IconArrowRight } from '@tabler/icons-react'
import { AnimatePresence, motion } from 'motion/react'

import { TagList } from '@components'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { pickRandom } from '@utils'

const TRANSITION = { duration: 0.18, ease: 'easeOut' } as const

// Picks a random untagged, thumbnail-ready photo — excludePath keeps
// "Tag another"/"Skip" from re-picking the photo just moved away from.
function pickUntagged(
  photosByPath: Map<string, PhotoRecord>,
  excludePath: string | null
): string | null {
  const candidates = Array.from(photosByPath.values()).filter(
    (photo) =>
      photo.tags.length === 0 &&
      photo.thumbnailStatus === 'ready' &&
      photo.thumbnailKey &&
      photo.filePath !== excludePath
  )
  if (candidates.length === 0) return null
  return pickRandom(candidates).filePath
}

export function QuickTagWidget(): ReactElement {
  const { state, allTags, updateTags } = usePhotoLibrary()
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion

  // Locked in (lazy init, then again on "Tag another"/"Skip") rather than
  // recomputed on every render — re-resolved against the live photo map
  // below so tags applied via TagList show immediately without the widget
  // swapping to a different photo out from under the user mid-edit.
  const [currentPath, setCurrentPath] = useState<string | null>(() =>
    pickUntagged(state.photosByPath, null)
  )
  const currentPhoto = currentPath ? (state.photosByPath.get(currentPath) ?? null) : null

  const handleNext = (): void => {
    setCurrentPath(pickUntagged(state.photosByPath, currentPath))
  }

  return (
    <AnimatePresence mode="wait">
      {currentPhoto ? (
        <motion.div
          key={currentPhoto.filePath}
          initial={motionEnabled ? { opacity: 0, x: 24 } : false}
          animate={{ opacity: 1, x: 0 }}
          exit={motionEnabled ? { opacity: 0, x: -24 } : undefined}
          transition={TRANSITION}
          style={{ width: '100%' }}
        >
          <Stack gap="sm">
            <Image
              src={toThumbProtocolUrl(currentPhoto.thumbnailKey!)}
              alt={currentPhoto.fileName}
              fit="contain"
              radius="sm"
              mah={180}
            />
            <Text size="sm" c="dimmed" truncate="end">
              {currentPhoto.fileName}
            </Text>
            <TagList
              tags={currentPhoto.tags}
              allTags={allTags}
              recentTags={state.recentTags}
              onChange={(tags) => void updateTags(currentPhoto.filePath, tags)}
            />
            <Group justify="flex-end">
              {currentPhoto.tags.length > 0 ? (
                <Button rightSection={<IconArrowRight size={14} />} onClick={handleNext}>
                  Tag another
                </Button>
              ) : (
                <Button variant="subtle" onClick={handleNext}>
                  Skip
                </Button>
              )}
            </Group>
          </Stack>
        </motion.div>
      ) : (
        <motion.div key="empty" style={{ width: '100%' }}>
          <Text c="dimmed" size="sm">
            Every photo is tagged — nice work!
          </Text>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
