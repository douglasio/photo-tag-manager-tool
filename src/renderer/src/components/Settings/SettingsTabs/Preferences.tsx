import { type ReactElement, useCallback, useEffect, useState } from 'react'

import { Button, Group, Kbd, Radio, Stack, Switch, Text, TextInput } from '@mantine/core'

import { ConfirmDialog } from '@components'
import type { DefaultView, PersonRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'

import SettingsTabSection from './SettingsTabSection'

interface AutoSaveTextInputProps {
  label: string
  value: string
  onSave: (value: string) => void
}

function AutoSaveTextInput({ label, value, onSave }: AutoSaveTextInputProps): ReactElement {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [saveCount, setSaveCount] = useState(0)

  // Resync the draft if the persisted value changes from outside this
  // component (e.g. hydration finishing after mount) — adjusted during
  // render per this codebase's convention, rather than a useEffect.
  const [synced, setSynced] = useState(value)
  if (synced !== value) {
    setSynced(value)
    setDraft(value)
  }

  return (
    <TextInput
      label={label}
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        onSave(draft.trim())
        setShowSaved(true)
        setSaveCount((count) => count + 1)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      rightSectionWidth={110}
      rightSection={
        focused ? (
          <Kbd size="xs">Enter</Kbd>
        ) : showSaved ? (
          <Text
            key={saveCount}
            size="xs"
            c="teal"
            className="settings-save-message"
            onAnimationEnd={() => setShowSaved(false)}
          >
            Saved
          </Text>
        ) : null
      }
    />
  )
}

function GeneralSection(): ReactElement {
  const { state, setDefaultView, setGalleryAnimationsEnabled } = usePhotoLibrary()

  return (
    <Stack>
      <Radio.Group
        label="Start tab:"
        value={state.defaultView}
        onChange={(value) => setDefaultView(value as DefaultView)}
        styles={{ label: { paddingBottom: 'var(--mantine-spacing-sm)' } }}
      >
        <Group>
          <Radio value="dashboard" label="Dashboard" />
          <Radio value="gallery" label="Gallery" />
        </Group>
      </Radio.Group>

      <Switch
        label="Enable animations"
        description="Show various animations when navigating the app. Automatically off if your system prefers reduced motion."
        checked={state.galleryAnimationsEnabled}
        onChange={(event) => setGalleryAnimationsEnabled(event.currentTarget.checked)}
      />
    </Stack>
  )
}

function GallerySection(): ReactElement {
  const { state, setShowEmptyFolders, setShowFilenames, setShowViewCounts } = usePhotoLibrary()

  return (
    <Stack>
      <Switch
        label="Show empty folders in folder tree"
        checked={state.showEmptyFolders}
        onChange={(event) => setShowEmptyFolders(event.currentTarget.checked)}
      />
      <Switch
        label="Show filenames under thumbnails"
        checked={state.showFilenames}
        onChange={(event) => setShowFilenames(event.currentTarget.checked)}
      />
      <Switch
        label="Show view counts under thumbnails"
        checked={state.showViewCounts}
        onChange={(event) => setShowViewCounts(event.currentTarget.checked)}
      />
    </Stack>
  )
}

function VisualizationsSection(): ReactElement {
  const { state, setMagazineTitle, setNewspaperTitle, setDvdStudioName, setArtGalleryName } =
    usePhotoLibrary()

  return (
    <Stack gap="xs">
      <Text c="dimmed" size="sm">
        Masthead/studio/gallery text shown on the Photo view&apos;s magazine, newspaper, DVD cover,
        and art gallery visualizations.
      </Text>
      <AutoSaveTextInput
        label="Magazine title"
        value={state.magazineTitle}
        onSave={setMagazineTitle}
      />
      <AutoSaveTextInput
        label="Newspaper"
        value={state.newspaperTitle}
        onSave={setNewspaperTitle}
      />
      <AutoSaveTextInput
        label="DVD production studio"
        value={state.dvdStudioName}
        onSave={setDvdStudioName}
      />
      <AutoSaveTextInput
        label="Art gallery name"
        value={state.artGalleryName}
        onSave={setArtGalleryName}
      />
    </Stack>
  )
}

function TagsSection(): ReactElement {
  const { state, setAiTagSuggestionsEnabled, enableAiFeatures } = usePhotoLibrary()
  const [error, setError] = useState<string | null>(null)
  const scanning = state.aiScanProgress !== null

  const handleToggle = async (checked: boolean): Promise<void> => {
    setError(null)
    if (!checked) {
      setAiTagSuggestionsEnabled(false)
      return
    }
    try {
      // enableAiFeatures drives its own progress/"ready" toast, tracked
      // regardless of which tab you're on — no separate feedback needed here.
      await enableAiFeatures()
    } catch (err) {
      console.error('failed to enable AI features', err)
      setError('Failed to download the AI model. Check your connection and try again.')
    }
  }

  return (
    <Stack gap="xs">
      <Switch
        label="Enable AI features"
        description="Downloads a small on-device model (~50-90MB) the first time you turn this on, then scans your library for tag suggestions, duplicate detection, and Time Warp — tracked in a progress toast. Runs fully offline afterward."
        checked={state.aiTagSuggestionsEnabled}
        disabled={scanning}
        onChange={(event) => void handleToggle(event.currentTarget.checked)}
      />
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
    </Stack>
  )
}

// People hidden via the People panel's context menu — still grouped/pinned
// underneath, just filtered out of the UI until un-hidden here. Fetched
// on-demand (not part of global state) the same way DetailPanelFaces fetches
// per-photo faces, since this only matters while Settings is open.
function HiddenPeopleList(): ReactElement | null {
  const { getHiddenPeople, unhidePerson } = usePhotoLibrary()
  const [hiddenPeople, setHiddenPeople] = useState<PersonRecord[] | null>(null)
  const [unhidingId, setUnhidingId] = useState<string | null>(null)

  const refresh = useCallback(() => getHiddenPeople().then(setHiddenPeople), [getHiddenPeople])

  useEffect(() => {
    let cancelled = false
    getHiddenPeople().then((people) => {
      if (!cancelled) setHiddenPeople(people)
    })
    return () => {
      cancelled = true
    }
  }, [getHiddenPeople])

  const handleUnhide = async (id: string): Promise<void> => {
    setUnhidingId(id)
    try {
      await unhidePerson(id)
      await refresh()
    } finally {
      setUnhidingId(null)
    }
  }

  if (!hiddenPeople || hiddenPeople.length === 0) return null

  return (
    <Stack gap="xs" mt="xs">
      <Text size="sm" fw={600}>
        Hidden people
      </Text>
      {hiddenPeople.map((person) => (
        <Group key={person.id} justify="space-between" wrap="nowrap">
          <Text size="sm" truncate="end">
            {person.name ?? 'Unnamed person'}
          </Text>
          <Button
            size="compact-xs"
            variant="subtle"
            loading={unhidingId === person.id}
            onClick={() => void handleUnhide(person.id)}
          >
            Unhide
          </Button>
        </Group>
      ))}
    </Stack>
  )
}

function PeopleSection(): ReactElement {
  const { state, setFaceDetectionEnabled, enableFaceDetection, rescanFaces } = usePhotoLibrary()
  const [error, setError] = useState<string | null>(null)
  const [confirmingDisable, setConfirmingDisable] = useState(false)
  const scanning = state.faceScanProgress !== null

  const handleToggle = async (checked: boolean): Promise<void> => {
    setError(null)
    if (!checked) {
      setConfirmingDisable(true)
      return
    }
    try {
      // enableFaceDetection drives its own progress/"ready" toast, tracked
      // regardless of which tab you're on — no separate feedback needed here.
      await enableFaceDetection()
    } catch (err) {
      console.error('failed to enable face detection', err)
      setError('Failed to scan your library for faces.')
    }
  }

  const handleRescan = async (): Promise<void> => {
    setError(null)
    try {
      // Also re-derives every person's cover photo/face crop (getPeople()
      // recomputes coverFaceBox fresh each call — see faceRepository.ts),
      // since refreshPeople() runs at the end of rescanFaces().
      await rescanFaces()
    } catch (err) {
      console.error('failed to rescan faces', err)
      setError('Failed to scan your library for faces.')
    }
  }

  const handleConfirmDisable = (): void => {
    setFaceDetectionEnabled(false)
    setConfirmingDisable(false)
  }

  return (
    <Stack gap="md" align="flex-start">
      <Switch
        label="Enable face detection"
        description={
          <Stack gap="md" align="flex-start">
            Detects and groups faces across your library so you can label people — a separate,
            heavier pass from AI tag suggestions. Uses bundled on-device models, so there&apos;s
            nothing to download; runs fully offline.
            {state.faceDetectionEnabled && (
              <Button variant="outline" loading={scanning} onClick={() => void handleRescan()}>
                Scan again
              </Button>
            )}
          </Stack>
        }
        checked={state.faceDetectionEnabled}
        disabled={scanning}
        onChange={(event) => void handleToggle(event.currentTarget.checked)}
      />
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
      {state.faceDetectionEnabled && <HiddenPeopleList />}
      <ConfirmDialog
        title="Disable face detection?"
        opened={confirmingDisable}
        saving={false}
        confirmLabel="Disable"
        confirmColor="red"
        onConfirm={handleConfirmDisable}
        onCancel={() => setConfirmingDisable(false)}
      >
        <Text size="sm">
          This deletes every detected face and person — labels, groupings, everything. It
          doesn&apos;t touch your photos, only the face data. Re-enabling later starts a completely
          fresh scan.
        </Text>
      </ConfirmDialog>
    </Stack>
  )
}

const sections = [
  { label: 'General', component: <GeneralSection /> },
  { label: 'Gallery', component: <GallerySection /> },
  { label: 'Tags', component: <TagsSection /> },
  { label: 'People', component: <PeopleSection /> },
  { label: 'Visualizations', component: <VisualizationsSection /> }
]

export const Preferences: React.FC = () => {
  return (
    <Stack gap="lg">
      {sections.map((section, i) => (
        <SettingsTabSection key={`${section.label}-${i}`} title={section.label}>
          {section.component}
        </SettingsTabSection>
      ))}
    </Stack>
  )
}
