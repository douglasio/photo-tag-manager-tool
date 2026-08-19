import { type ReactElement, useMemo, useState } from 'react'

import { Anchor, AspectRatio, Box, Loader, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { AnimatePresence, motion } from 'motion/react'

import { FaceCropThumbnail, PhotoGradientOverlay } from '@components'
import { RADIUS_SIZE } from '@renderer/theme'
import type { PersonRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'

const DISPLAY_CAP = 6

interface UnnamedPersonTileProps {
  person: PersonRecord
  coverThumbnailKey: string | null
}

// One tile's own name draft/save state — kept local (not lifted) since each
// person's naming is independent, matching PeoplePanel's per-row rename
// state. No view/edit toggle like PersonRow's, though: this person has no
// existing name to fall back to, so the field is just always an input.
function UnnamedPersonTile({ person, coverThumbnailKey }: UnnamedPersonTileProps): ReactElement {
  const { renamePerson } = usePhotoLibrary()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const hasThumbnail = Boolean(coverThumbnailKey && person.coverFaceBox)

  const save = async (): Promise<void> => {
    const trimmed = draft.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      await renamePerson(person.id, trimmed)
    } catch (err) {
      console.error(`failed to name person ${person.id}`, err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap={4}>
      <AspectRatio ratio={1} style={{ overflow: 'hidden', borderRadius: RADIUS_SIZE }}>
        {hasThumbnail ? (
          <Box className="dashboard-photo-frame">
            <FaceCropThumbnail thumbnailKey={coverThumbnailKey!} box={person.coverFaceBox!} />
            <PhotoGradientOverlay />
          </Box>
        ) : (
          <Box bg="var(--mantine-primary-color-light)" />
        )}
      </AspectRatio>
      <TextInput
        placeholder="Name this person"
        size="xs"
        value={draft}
        disabled={saving}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void save()
          }
        }}
        rightSection={saving ? <Loader size="xs" /> : undefined}
      />
    </Stack>
  )
}

// Shows people face-detection has clustered but nobody's named yet, each
// with an inline field to name them right from the dashboard — no need to
// visit the People panel just to clear a handful of these. Only ever
// mounted by DashboardView when at least one exists; the guard below is a
// cheap safety net, not the primary gate.
export function NameThisPersonWidget(): ReactElement | null {
  const { state, activePhotosByPath, setActiveTab, setNavbarCollapsedPanels } = usePhotoLibrary()
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion

  const unnamedPeople = useMemo(
    () => state.people.filter((person) => person.name === null),
    [state.people]
  )

  if (unnamedPeople.length === 0) return null

  const visible = unnamedPeople.slice(0, DISPLAY_CAP)
  const overflowCount = unnamedPeople.length - visible.length

  const goToPeoplePanel = (): void => {
    setActiveTab('gallery')
    setNavbarCollapsedPanels({ ...state.navbarCollapsedPanels, people: false })
  }

  return (
    <Stack gap="sm">
      <Text c="dimmed" size="sm">
        Face detection found these people but doesn&apos;t know their names yet.
      </Text>
      <SimpleGrid cols={3} spacing="sm">
        <AnimatePresence>
          {visible.map((person) => (
            <motion.div
              key={person.id}
              layout={motionEnabled}
              exit={motionEnabled ? { scale: 0.8, opacity: 0 } : undefined}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <UnnamedPersonTile
                person={person}
                coverThumbnailKey={
                  person.coverPhotoPath
                    ? (activePhotosByPath.get(person.coverPhotoPath)?.thumbnailKey ?? null)
                    : null
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </SimpleGrid>
      {overflowCount > 0 && (
        <Anchor size="sm" onClick={goToPeoplePanel}>
          +{overflowCount} more in the People panel
        </Anchor>
      )}
    </Stack>
  )
}
