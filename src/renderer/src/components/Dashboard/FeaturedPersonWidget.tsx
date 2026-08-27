import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react'

import { Carousel } from '@mantine/carousel'
import { Anchor, Badge, Button, Group, Stack, Text, Timeline } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconEye } from '@tabler/icons-react'

import type { PersonRecord, PhotoRecord } from '@shared/types'
import { usePhotoLibrary, usePreviewTriggerHeld } from '@state'
import { isPhotoDisplayable, pickRandom, shuffle } from '@utils'

import { PhotoCollageTile } from './PhotoCollageTile'

// A person needs at least this many assigned photos before they're eligible
// to be featured — mirrors FeaturedTagWidget's own threshold.
const FEATURED_PERSON_MIN_PHOTOS = 3
const COLLAGE_PHOTO_COUNT = 9
const CAROUSEL_SLIDES_VISIBLE = 3

const ONBOARDING_STEPS: { text: string; linkLabel?: string; action?: 'settings' }[] = [
  { text: 'Enable face detection', linkLabel: 'Open Settings', action: 'settings' },
  { text: 'Wait for the face scan to finish' },
  { text: 'Name a person in the People panel' },
  { text: `Reach ${FEATURED_PERSON_MIN_PHOTOS} photos with them` }
]

interface FeaturedSelection {
  personId: string
  // Locked in alongside the person, not recomputed on every render — see
  // FeaturedTagWidget's identical field for why.
  photoPaths: string[]
}

function pickQualifyingPerson(
  people: PersonRecord[],
  personPhotoAssignments: Map<string, Set<string>>
): string | null {
  const qualifying = people.filter(
    (person) =>
      person.name !== null &&
      (personPhotoAssignments.get(person.id)?.size ?? 0) >= FEATURED_PERSON_MIN_PHOTOS
  )
  if (qualifying.length === 0) return null
  return pickRandom(qualifying).id
}

function pickRandomCollagePaths(
  photosByPath: Map<string, PhotoRecord>,
  photoPaths: Set<string> | undefined,
  count: number
): string[] {
  const candidates = Array.from(photoPaths ?? [])
    .map((path) => photosByPath.get(path))
    .filter((photo): photo is PhotoRecord => photo != null && isPhotoDisplayable(photo))
  return shuffle(candidates)
    .slice(0, count)
    .map((photo) => photo.filePath)
}

function pickSelection(
  people: PersonRecord[],
  personPhotoAssignments: Map<string, Set<string>>,
  photosByPath: Map<string, PhotoRecord>
): FeaturedSelection | null {
  const personId = pickQualifyingPerson(people, personPhotoAssignments)
  if (!personId) return null
  return {
    personId,
    photoPaths: pickRandomCollagePaths(
      photosByPath,
      personPhotoAssignments.get(personId),
      COLLAGE_PHOTO_COUNT
    )
  }
}

export function FeaturedPersonWidget(): ReactElement {
  const {
    state,
    activePhotosByPath,
    openPhotoTab,
    setPersonFilter,
    setActiveTab,
    setSettingsModalOpened
  } = usePhotoLibrary()
  const previewTriggerHeld = usePreviewTriggerHeld()
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion

  const [selection, setSelection] = useState<FeaturedSelection | null>(() =>
    pickSelection(state.people, state.personPhotoAssignments, activePhotosByPath)
  )
  if (selection === null) {
    const picked = pickSelection(state.people, state.personPhotoAssignments, activePhotosByPath)
    if (picked) setSelection(picked)
  }
  const selectedPersonId = selection?.personId ?? null
  // Re-resolved fresh each render (not stored) so a rename mid-session is
  // reflected immediately — same reasoning as collagePhotos below.
  const person = selectedPersonId
    ? (state.people.find((candidate) => candidate.id === selectedPersonId) ?? null)
    : null

  const collagePhotos = useMemo(() => {
    if (!selection) return []
    return selection.photoPaths
      .map((path) => activePhotosByPath.get(path))
      .filter((photo): photo is PhotoRecord => photo != null)
  }, [selection, activePhotosByPath])

  const photoCount = selectedPersonId
    ? (state.personPhotoAssignments.get(selectedPersonId)?.size ?? 0)
    : 0
  const viewCount = useMemo(() => {
    const paths = selectedPersonId ? state.personPhotoAssignments.get(selectedPersonId) : undefined
    if (!paths) return 0
    let total = 0
    for (const path of paths) total += activePhotosByPath.get(path)?.viewCount ?? 0
    return total
  }, [selectedPersonId, state.personPhotoAssignments, activePhotosByPath])

  const goToPerson = (personId: string): void => {
    setPersonFilter(personId)
    setActiveTab('gallery')
  }

  // Computed unconditionally so the toast effect below can watch it
  // regardless of which view (onboarding vs. featured) is showing.
  const namedPeople = state.people.filter((candidate) => candidate.name !== null)
  const closestPhotoCount =
    namedPeople.length > 0
      ? Math.max(
          ...namedPeople.map(
            (candidate) => state.personPhotoAssignments.get(candidate.id)?.size ?? 0
          )
        )
      : 0
  const stepsDone = [
    state.faceDetectionEnabled,
    state.people.length > 0,
    namedPeople.length > 0,
    closestPhotoCount >= FEATURED_PERSON_MIN_PHOTOS
  ]
  const activeIndex = stepsDone.filter(Boolean).length

  const lastActiveIndexRef = useRef(activeIndex)
  const hasShownReadyToastRef = useRef(selectedPersonId !== null)

  // Mirrors FeaturedTagWidget's toast effect — fires the instant an
  // onboarding step completes, plus a distinct one once a person is
  // actually featured, both only on a genuine transition.
  useEffect(() => {
    if (person) {
      if (!hasShownReadyToastRef.current) {
        hasShownReadyToastRef.current = true
        notifications.show({
          autoClose: 10000,
          color: 'teal',
          message: `${person.name} now has enough photos to be featured on the Dashboard!`,
          onClick: () => setActiveTab('dashboard'),
          withCloseButton: true
        })
      }
      return
    }
    if (activeIndex > lastActiveIndexRef.current) {
      const completedStep = ONBOARDING_STEPS[activeIndex - 1]
      notifications.show({
        color: 'teal',
        autoClose: 6000,
        message: (
          <Stack gap={4}>
            <Text size="sm">Step complete: {completedStep.text}</Text>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => setActiveTab('dashboard')}
              style={{ alignSelf: 'flex-start' }}
            >
              Back to Dashboard
            </Button>
          </Stack>
        )
      })
    }
    lastActiveIndexRef.current = activeIndex
  }, [activeIndex, person, setActiveTab])

  if (person) {
    return (
      <Stack gap="xs" h="100%" mih={0}>
        <Stack gap={4} style={{ flexShrink: 0 }}>
          <Group justify="space-between" w="100%">
            <Anchor size="xl" fw="bold" onClick={() => goToPerson(person.id)}>
              {person.name}
            </Anchor>
            <Group gap="xs">
              <Badge
                component="button"
                size="md"
                style={{ cursor: 'pointer' }}
                onClick={() => goToPerson(person.id)}
              >
                {photoCount} photos
              </Badge>
              <Badge size="md" leftSection={<IconEye size={12} />}>
                {viewCount} views
              </Badge>
            </Group>
          </Group>
          {person.description && (
            <Text c="dimmed" fs="italic" size="sm">
              {person.description}
            </Text>
          )}
        </Stack>

        <Carousel
          slideSize={`${100 / CAROUSEL_SLIDES_VISIBLE}%`}
          slideGap="xs"
          height="100%"
          mih={0}
          style={{ flex: 1 }}
          withControls={collagePhotos.length > CAROUSEL_SLIDES_VISIBLE}
          emblaOptions={{ loop: true }}
        >
          {collagePhotos.map((photo) => (
            <Carousel.Slide key={photo.id} h="100%">
              <PhotoCollageTile
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

  const runStepAction = (action?: 'settings'): void => {
    if (action === 'settings') setSettingsModalOpened(true)
  }

  return (
    <>
      <Text c="dimmed" mb="md">
        Enable face detection and name someone to feature them here.
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
