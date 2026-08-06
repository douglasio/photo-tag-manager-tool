import { type ReactElement, useState } from 'react'

import { Kbd, Stack, Switch, Text, TextInput } from '@mantine/core'

import { usePhotoLibrary } from '@state'

import SettingsTabSection from './SettingsTabSection'

interface AutoSaveTextInputProps {
  label: string
  value: string
  onSave: (value: string) => void
}

// Saved on blur (or Enter, which just blurs). Shows an "Enter to save" hint
// while focused, then a "Saved" message that fades out via CSS animation
// (settings-save-message in main.css) once it blurs — remounted via
// `saveCount` as key so saving again while a previous fade is still playing
// restarts the animation instead of no-op'ing.
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
    <Stack gap="xs">
      <Switch
        label="Open to Dashboard on launch"
        description="When off, the app opens to Gallery instead."
        checked={state.defaultView === 'dashboard'}
        onChange={(event) => setDefaultView(event.currentTarget.checked ? 'dashboard' : 'gallery')}
      />

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
  const { state, setMagazineTitle, setNewspaperTitle, setDvdStudioName } = usePhotoLibrary()

  return (
    <Stack gap="xs">
      <Text c="dimmed" size="sm">
        Masthead/studio text shown on the Photo view&apos;s magazine, newspaper, and DVD cover
        visualizations.
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
    </Stack>
  )
}

const sections = [
  { label: 'General', component: <GeneralSection /> },
  { label: 'Gallery', component: <GallerySection /> },
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
