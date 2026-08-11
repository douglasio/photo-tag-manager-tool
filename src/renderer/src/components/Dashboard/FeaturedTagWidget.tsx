import { type ReactElement, useMemo, useState } from 'react'

import { Carousel } from '@mantine/carousel'
import {
  Anchor,
  Badge,
  Button,
  Group,
  Image,
  Stack,
  Text,
  Timeline,
  UnstyledButton
} from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'

import { GalleryHoverPreview, PhotoGradientOverlay } from '@components'
import { useHoverPreview, useKeyHeld } from '@hooks'
import { RADIUS_SIZE } from '@renderer/theme'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { pickRandom, PREVIEW_TRIGGER_KEY, shuffle } from '@utils'

// A tag needs at least this many photos before it's eligible to be featured.
const FEATURED_TAG_MIN_PHOTOS = 3
const COLLAGE_PHOTO_COUNT = 9
const CAROUSEL_SLIDES_VISIBLE = 3

// `action` names which handler (below, in the component) the step's link
// should call — steps with no action render as plain text.
const ONBOARDING_STEPS: { text: string; linkLabel?: string; action?: 'settings' | 'gallery' }[] = [
  { text: 'Add photos to your library', linkLabel: 'Open Settings', action: 'settings' },
  { text: 'Tag a photo', linkLabel: 'Open Gallery', action: 'gallery' },
  { text: 'Use that tag on a second photo' },
  { text: 'Use that tag on a third photo' }
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

// Each tile gets its own hover-preview session (mirrors gallery thumbnails)
// rather than sharing one at the widget level, since a Carousel of
// independent slides has no shared "currently hovered photo" state to hang
// a single preview off of.
function CollageTile({
  photo,
  previewTriggerHeld,
  motionEnabled,
  onOpen
}: {
  photo: PhotoRecord
  previewTriggerHeld: boolean
  motionEnabled: boolean
  onOpen: () => void
}): ReactElement {
  const canPreview = previewTriggerHeld && photo.thumbnailStatus === 'ready'
  const { position, onMouseMove, onMouseLeave } = useHoverPreview(canPreview)

  return (
    <>
      <UnstyledButton
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === PREVIEW_TRIGGER_KEY) event.preventDefault()
        }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="dashboard-photo-frame"
        h="100%"
        w="100%"
        display="block"
        style={{ minHeight: 0, cursor: canPreview ? 'zoom-in' : undefined }}
      >
        <Image
          src={toThumbProtocolUrl(photo.thumbnailKey!)}
          alt={photo.fileName}
          fit="cover"
          h="100%"
          w="100%"
          bdrs={RADIUS_SIZE}
        />
        <PhotoGradientOverlay />
      </UnstyledButton>
      <GalleryHoverPreview
        photo={photo}
        position={canPreview ? position : null}
        scale={1}
        motionEnabled={motionEnabled}
      />
    </>
  )
}

export function FeaturedTagWidget(): ReactElement {
  const {
    state,
    tagCounts,
    allTags,
    openPhotoTab,
    setTagFilter,
    setActiveTab,
    setSettingsModalOpened
  } = usePhotoLibrary()
  const previewTriggerHeld = useKeyHeld(PREVIEW_TRIGGER_KEY)
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion

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

  const goToTag = (tag: string): void => {
    setTagFilter(tag)
    setActiveTab('gallery')
  }

  if (selectedTag) {
    return (
      <Stack gap="xs" h="100%" style={{ minHeight: 0 }}>
        <Stack gap={4} style={{ flexShrink: 0 }}>
          <Group justify="space-between" w="100%">
            <Anchor size="xl" fw="bold" onClick={() => goToTag(selectedTag)} variant="gradient">
              #{selectedTag}
            </Anchor>
            <Badge
              component="button"
              variant="gradient"
              size="md"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                goToTag(selectedTag)
              }}
            >
              {tagCounts.get(selectedTag) ?? 0} photos
            </Badge>
          </Group>
          {state.tagDescriptions.get(selectedTag) && (
            <Text c="dimmed" fs="italic" size="sm">
              {state.tagDescriptions.get(selectedTag)}
            </Text>
          )}
        </Stack>

        <Carousel
          slideSize={`${100 / CAROUSEL_SLIDES_VISIBLE}%`}
          slideGap="xs"
          height="100%"
          style={{ flex: 1, minHeight: 0 }}
          withControls={collagePhotos.length > CAROUSEL_SLIDES_VISIBLE}
          emblaOptions={{ loop: true }}
        >
          {collagePhotos.map((photo) => (
            <Carousel.Slide key={photo.id} h="100%">
              <CollageTile
                photo={photo}
                previewTriggerHeld={previewTriggerHeld}
                motionEnabled={motionEnabled}
                onOpen={() => openPhotoTab(photo.filePath)}
              />
            </Carousel.Slide>
          ))}
        </Carousel>
      </Stack>
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

  const runStepAction = (action?: 'settings' | 'gallery'): void => {
    if (action === 'settings') setSettingsModalOpened(true)
    else if (action === 'gallery') setActiveTab('gallery')
  }

  return (
    <>
      <Text c="dimmed" mb="md">
        Tag {FEATURED_TAG_MIN_PHOTOS} or more photos with the same tag to feature them here.
      </Text>
      <Timeline active={activeIndex} bulletSize={20}>
        {ONBOARDING_STEPS.map((step, index) => {
          const isDone = index < activeIndex
          return (
            <Timeline.Item
              key={step.text}
              title={
                <Group>
                  <Text span c={isDone ? 'dimmed' : undefined} fs={isDone ? 'italic' : undefined}>
                    {step.text}
                  </Text>
                  {step.linkLabel && !isDone && (
                    <Button
                      variant="outline"
                      size="compact-sm"
                      onClick={() => runStepAction(step.action)}
                      m="0"
                    >
                      {step.linkLabel}
                    </Button>
                  )}
                </Group>
              }
            />
          )
        })}
      </Timeline>
    </>
  )
}
