import { type ReactElement, useState } from 'react'

import { ActionIcon, Tooltip } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'

import { usePhotoLibrary } from '@state'

import { TagGroupNameDialog } from './TagGroupNameDialog'

export function TagGroupCreateButton(): ReactElement {
  const { state, createTagGroup } = usePhotoLibrary()
  const [opened, setOpened] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleConfirm = async (name: string): Promise<void> => {
    setSaving(true)
    try {
      await createTagGroup(name)
      setOpened(false)
    } catch {
      // createTagGroup already surfaces an error toast — leave the dialog
      // open so the user can retry or cancel.
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Tooltip label="New tag group">
        <ActionIcon variant="subtle" aria-label="New tag group" onClick={() => setOpened(true)}>
          <IconPlus size={16} />
        </ActionIcon>
      </Tooltip>
      <TagGroupNameDialog
        title="New tag group"
        confirmLabel="Create"
        opened={opened}
        saving={saving}
        initialName=""
        existingNames={state.tagGroups.map((group) => group.name)}
        onConfirm={(name) => void handleConfirm(name)}
        onCancel={() => setOpened(false)}
      />
    </>
  )
}
