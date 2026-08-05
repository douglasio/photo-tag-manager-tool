import { type ReactElement, useState } from 'react'

import { Box, Button, Card, Group, Image, Stack, Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { IconArrowRight } from '@tabler/icons-react'
import { AnimatePresence, motion } from 'motion/react'

import { GalleryHoverPreview, PhotoGradientOverlay, TagList } from '@components'
import { useHoverPreview, useKeyHeld } from '@hooks'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { pickRandom, PREVIEW_TRIGGER_KEY } from '@utils'

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
  const previewTriggerHeld = useKeyHeld(PREVIEW_TRIGGER_KEY)

  // Locked in (lazy init, then again on "Tag another"/"Skip") rather than
  // recomputed on every render — re-resolved against the live photo map
  // below so tags applied via TagList show immediately without the widget
  // swapping to a different photo out from under the user mid-edit.
  const [currentPath, setCurrentPath] = useState<string | null>(() =>
    pickUntagged(state.photosByPath, null)
  )
  const currentPhoto = currentPath ? (state.photosByPath.get(currentPath) ?? null) : null
  const canPreview = previewTriggerHeld && currentPhoto?.thumbnailStatus === 'ready'
  const { position, onMouseMove, onMouseLeave } = useHoverPreview(canPreview)

  const handleNext = (): void => {
    setCurrentPath(pickUntagged(state.photosByPath, currentPath))
  }

  return (
    <Stack h="100%" mih={0} gap="sm">
      <Text c="dimmed" flex="0 0 auto">
        Add a tag to this untagged photo:
      </Text>
      <AnimatePresence mode="wait">
        {currentPhoto ? (
          <motion.div
            key={currentPhoto.filePath}
            initial={motionEnabled ? { opacity: 0, x: 24 } : false}
            animate={{ opacity: 1, x: 0 }}
            exit={motionEnabled ? { opacity: 0, x: -24 } : undefined}
            transition={TRANSITION}
            style={{ width: '100%', flex: 1, minHeight: 0 }}
          >
            <Card
              h="100%"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
            >
              <Card.Section
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                pos="relative"
                className="dashboard-photo-frame"
                style={{ cursor: canPreview ? 'zoom-in' : undefined }}
              >
                <Image
                  src={toThumbProtocolUrl(currentPhoto.thumbnailKey!)}
                  alt={currentPhoto.fileName}
                  radius="sm"
                  fit="fill"
                />
                <PhotoGradientOverlay />
              </Card.Section>
              <GalleryHoverPreview
                photo={currentPhoto}
                position={canPreview ? position : null}
                scale={1}
                motionEnabled={motionEnabled}
              />
              <Group wrap="nowrap" mt="md">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <TagList
                    tags={currentPhoto.tags}
                    allTags={allTags}
                    recentTags={state.recentTags}
                    onChange={(tags) => void updateTags(currentPhoto.filePath, tags)}
                  />
                </Box>
                {currentPhoto.tags.length > 0 ? (
                  <Button
                    rightSection={<IconArrowRight size={14} />}
                    onClick={handleNext}
                    style={{ flexShrink: 0 }}
                  >
                    Tag another
                  </Button>
                ) : (
                  <Button variant="subtle" onClick={handleNext} style={{ flexShrink: 0 }}>
                    Skip
                  </Button>
                )}
              </Group>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="empty" style={{ width: '100%' }}>
            <Text c="dimmed" size="sm">
              Every photo is tagged — nice work!
            </Text>
          </motion.div>
        )}
      </AnimatePresence>
    </Stack>
  )
}
