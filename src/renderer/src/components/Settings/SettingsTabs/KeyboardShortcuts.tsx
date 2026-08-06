import React from 'react'

import { DataList, Kbd } from '@mantine/core'

import SettingsTabSection from './SettingsTabSection'

export const KeyboardShortcuts: React.FC = () => {
  const shortcuts = [
    { label: 'Dashboard view', shortcut: 'D' },
    { label: 'Gallery view', shortcut: 'G' },
    { label: 'Quick zoom', shortcut: 'Space' },
    { label: 'Close image', shortcut: 'Esc' }
  ]

  return (
    <SettingsTabSection>
      <DataList orientation="horizontal" withDivider>
        {shortcuts.map(({ label, shortcut }) => (
          <DataList.Item key={label}>
            <DataList.ItemLabel>{label}</DataList.ItemLabel>
            <DataList.ItemValue>
              <Kbd>{shortcut}</Kbd>
            </DataList.ItemValue>
          </DataList.Item>
        ))}
      </DataList>
    </SettingsTabSection>
  )
}
