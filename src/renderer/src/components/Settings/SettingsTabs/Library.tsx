import React, { type ReactElement } from 'react'

import { Button, Stack, Table, TagsInput, Text } from '@mantine/core'

import { FolderRemoveButton } from '@components'
import { usePhotoLibrary } from '@state'

import SettingsTabSection from './SettingsTabSection'

function FoldersSection(): ReactElement {
  const { state, addFolder } = usePhotoLibrary()

  return (
    <Stack>
      {state.folders.length === 0 ? (
        <Text c="dimmed" size="sm">
          No folders added yet.
        </Text>
      ) : (
        <Table striped highlightOnHover layout="fixed" verticalSpacing="xs">
          <Table.Tbody>
            {state.folders.map((folder) => (
              <Table.Tr key={folder}>
                <Table.Td>
                  <Text truncate="end" miw={0} title={folder}>
                    {folder}
                  </Text>
                </Table.Td>
                <Table.Td w={44}>
                  <FolderRemoveButton folder={folder} count={state.folderCounts.get(folder) ?? 0} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Button onClick={() => void addFolder()} style={{ alignSelf: 'flex-start' }}>
        Add Folder…
      </Button>
    </Stack>
  )
}

function ExcludePatternsSection(): ReactElement {
  const { state, setExcludePatterns } = usePhotoLibrary()

  return (
    <Stack>
      <Text c="dimmed" size="sm">
        Folders or files whose path contains any of these (case-insensitive) are skipped during
        scanning.
      </Text>
      <TagsInput
        value={state.excludePatterns}
        onChange={(patterns) => void setExcludePatterns(patterns)}
        placeholder="Add a pattern…"
      />
    </Stack>
  )
}

const sections = [
  { label: 'Folders', component: <FoldersSection /> },
  { label: 'Exclude Patterns', component: <ExcludePatternsSection /> }
]

export const Library: React.FC = () => {
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

export default Library
