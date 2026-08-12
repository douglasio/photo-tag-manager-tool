import { type ReactElement, useState } from 'react'

import { Box, Button, Flex, Image, SimpleGrid, Stack, Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { IconArrowRight } from '@tabler/icons-react'
import { AnimatePresence, motion } from 'motion/react'

import { GalleryHoverPreview, PhotoGradientOverlay, SuggestedTagsRow, TagList } from '@components'
import { useHoverPreview, useKeyHeld, useTagSuggestions } from '@hooks'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { pickRandom, PREVIEW_TRIGGER_KEY } from '@utils'

import { useDashboardPreviewScale } from './DashboardPreviewZoomContext'

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

export function TagThisPhotoWidget(): ReactElement {
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
  const previewScale = useDashboardPreviewScale()
  const { suggestions, loading: loadingSuggestions } = useTagSuggestions(
    currentPhoto?.filePath ?? '',
    currentPhoto?.tags ?? [],
    Boolean(currentPhoto) && state.aiTagSuggestionsEnabled
  )

  const handleNext = (): void => {
    setCurrentPath(pickUntagged(state.photosByPath, currentPath))
  }

  return (
    <AnimatePresence mode="wait">
      {currentPhoto ? (
        <motion.div
          key={currentPhoto.filePath}
          className="flex-fill"
          initial={motionEnabled ? { opacity: 0, x: 24 } : false}
          animate={{ opacity: 1, x: 0 }}
          exit={motionEnabled ? { opacity: 0, x: -24 } : undefined}
          transition={TRANSITION}
          style={{ height: '100%' }}
        >
          <SimpleGrid cols={2} spacing="md" h="100%" autoRows="100%">
            <Flex h="100%" w="100%" justify="center" mih="0">
              <Box
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                pos="relative"
                h="100%"
                className="dashboard-photo-frame"
                style={{
                  aspectRatio: '1',
                  cursor: canPreview ? 'zoom-in' : undefined,
                  overflow: 'hidden'
                }}
              >
                <Image
                  src={toThumbProtocolUrl(currentPhoto.thumbnailKey!)}
                  alt={currentPhoto.fileName}
                  fit="cover"
                  h="100%"
                  w="100%"
                />
                <PhotoGradientOverlay />
              </Box>
            </Flex>
            <GalleryHoverPreview
              photo={currentPhoto}
              position={canPreview ? position : null}
              scale={previewScale}
              motionEnabled={motionEnabled}
            />
            <Stack h="100%" gap="md">
              <SuggestedTagsRow
                suggestions={suggestions}
                loading={loadingSuggestions}
                size="large"
                onAccept={(tag) =>
                  void updateTags(currentPhoto.filePath, [...currentPhoto.tags, tag])
                }
              />
              <TagList
                tags={currentPhoto.tags}
                allTags={allTags}
                recentTags={state.recentTags}
                onChange={(tags) => void updateTags(currentPhoto.filePath, tags)}
              />
              {currentPhoto.tags.length > 0 ? (
                <Button
                  rightSection={<IconArrowRight size={14} />}
                  onClick={handleNext}
                  style={{ alignSelf: 'flex-start', marginTop: 'auto' }}
                >
                  Tag another
                </Button>
              ) : (
                <Button onClick={handleNext} style={{ alignSelf: 'flex-end', marginTop: 'auto' }}>
                  Skip
                </Button>
              )}
            </Stack>
          </SimpleGrid>
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
