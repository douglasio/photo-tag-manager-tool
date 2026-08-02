import { type ReactElement, useMemo, useState } from 'react'

import {
  AspectRatio,
  Badge,
  Grid,
  Group,
  Image,
  Paper,
  Text,
  Timeline,
  Title,
  UnstyledButton
} from '@mantine/core'

import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { pickRandom, shuffle } from '@utils'

// A tag needs at least this many photos before it's eligible to be featured.
const FEATURED_TAG_MIN_PHOTOS = 3
const COLLAGE_PHOTO_COUNT = 4

const ONBOARDING_STEPS = [
  'Add photos to your library',
  'Tag a photo',
  'Use that tag on a second photo',
  'Use that tag on a third photo'
]

interface FeaturedSelection {
  tag: string
  // Locked in alongside the tag itself, not recomputed on every render — a
  // fresh Math.random() pick each render would otherwise reshuffle the
  // collage on every unrelated library change while the dashboard sits open.
  photoPaths: string[]
}

function pickQualifyingTag(tagCounts: Map<string, number>, allTags: string[]): string | null {
  const qualifying = allTags.filter((tag) => (tagCounts.get(tag) ?? 0) >= FEATURED_TAG_MIN_PHOTOS)
  if (qualifying.length === 0) return null
  return pickRandom(qualifying)
}

function pickRandomCollagePaths(
  photosByPath: Map<string, PhotoRecord>,
  tag: string,
  count: number
): string[] {
  const candidates = Array.from(photosByPath.values()).filter(
    (photo) => photo.tags.includes(tag) && photo.thumbnailStatus === 'ready' && photo.thumbnailKey
  )
  return shuffle(candidates)
    .slice(0, count)
    .map((photo) => photo.filePath)
}

function pickSelection(
  tagCounts: Map<string, number>,
  allTags: string[],
  photosByPath: Map<string, PhotoRecord>
): FeaturedSelection | null {
  const tag = pickQualifyingTag(tagCounts, allTags)
  if (!tag) return null
  return { tag, photoPaths: pickRandomCollagePaths(photosByPath, tag, COLLAGE_PHOTO_COUNT) }
}

export function FeaturedTagWidget(): ReactElement {
  const { state, tagCounts, allTags, openPhotoTab, setTagFilter, setActiveTab } = usePhotoLibrary()

  // Picks a tag (and its collage) on first render that persists through the
  // session — see FeaturedSelection above for why the collage is locked in
  // here too, not derived fresh each render.
  const [selection, setSelection] = useState<FeaturedSelection | null>(() =>
    pickSelection(tagCounts, allTags, state.photosByPath)
  )
  if (selection === null) {
    const picked = pickSelection(tagCounts, allTags, state.photosByPath)
    if (picked) setSelection(picked)
  }
  const selectedTag = selection?.tag ?? null

  // Re-resolved against the live photo map (not stored directly) so a
  // selected photo's thumbnail/status stays current even though which
  // photos were picked doesn't change.
  const collagePhotos = useMemo(() => {
    if (!selection) return []
    return selection.photoPaths
      .map((path) => state.photosByPath.get(path))
      .filter((photo): photo is PhotoRecord => photo != null)
  }, [selection, state.photosByPath])

  const goToTag = (tag): void => {
    setTagFilter(tag)
    setActiveTab('gallery')
  }

  if (selectedTag) {
    return (
      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm" wrap="nowrap">
          <Title order={2} flex={1} miw={0} lineClamp={1}>
            Featured Tag:{' '}
            <Text
              component="button"
              onClick={() => goToTag(selectedTag)}
              bd={0}
              variant="gradient"
              span
              inherit
            >
              #{selectedTag}
            </Text>
          </Title>
          <Badge
            component="button"
            variant="light"
            style={{ flexShrink: 0, cursor: 'pointer' }}
            onClick={() => {
              goToTag(selectedTag)
            }}
          >
            {tagCounts.get(selectedTag) ?? 0} photos
          </Badge>
        </Group>
        <Grid grow>
          {collagePhotos.map((photo, index) => {
            // Two per row (span={6} of 12) — with `grow`, a lone leftover in
            // the last row stretches to fill the full row width instead of
            // sitting half-width next to nothing. Doubling its aspect ratio
            // alongside that doubled width keeps its height matched to the
            // square photos above it, rather than rendering twice as tall.
            const isLastOfOddRow =
              collagePhotos.length % 2 === 1 && index === collagePhotos.length - 1
            return (
              <Grid.Col key={photo.id} span={6}>
                <UnstyledButton
                  onClick={() => openPhotoTab(photo.filePath)}
                  w="100%"
                  display="block"
                >
                  <AspectRatio ratio={isLastOfOddRow ? 2 : 1}>
                    <Image
                      src={toThumbProtocolUrl(photo.thumbnailKey!)}
                      alt={photo.fileName}
                      fit="cover"
                      radius="sm"
                    />
                  </AspectRatio>
                </UnstyledButton>
              </Grid.Col>
            )
          })}
        </Grid>
      </Paper>
    )
  }

  // Onboarding — no tag has reached the threshold yet. Live-updates as the
  // user adds photos/tags rather than only checking once, so the active step
  // actually reflects real progress.
  const closestTagCount = tagCounts.size > 0 ? Math.max(...tagCounts.values()) : 0
  const stepsDone = [
    state.photosByPath.size > 0,
    closestTagCount >= 1,
    closestTagCount >= 2,
    closestTagCount >= 3
  ]
  const activeIndex = stepsDone.filter(Boolean).length

  return (
    <Paper withBorder p="md">
      <Title order={4} mb="sm">
        Featured Tag
      </Title>
      <Text c="dimmed" size="sm" mb="md">
        Tag {FEATURED_TAG_MIN_PHOTOS} or more photos the same way to feature them here.
      </Text>
      <Timeline active={activeIndex} bulletSize={20}>
        {ONBOARDING_STEPS.map((step) => (
          <Timeline.Item key={step} title={step} />
        ))}
      </Timeline>
    </Paper>
  )
}
