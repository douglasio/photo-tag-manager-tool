import { type ReactElement } from 'react'

import { Burger, Button, Group, Modal, Stack, Tabs, Title, Tooltip } from '@mantine/core'
import { IconKeyboard, IconLibraryPhoto, IconTool } from '@tabler/icons-react'

import { usePhotoLibrary } from '@state'

import * as SettingsTab from './SettingsTabs'

export function SettingsModal(): ReactElement {
  const { state, setSettingsModalOpened } = usePhotoLibrary()
  const opened = state.settingsModalOpened
  const open = (): void => setSettingsModalOpened(true)
  const close = (): void => setSettingsModalOpened(false)

  const ICON_SIZE = 20

  const settingsTabs = [
    {
      label: 'Library',
      value: 'library',
      icon: <IconLibraryPhoto size={ICON_SIZE} />,
      component: <SettingsTab.Library />
    },
    {
      label: 'Preferences',
      value: 'preferences',
      icon: <IconTool size={ICON_SIZE} />,
      component: <SettingsTab.Preferences />
    },
    {
      label: 'Keyboard Shortcuts',
      value: 'shortcuts',
      icon: <IconKeyboard size={ICON_SIZE} />,
      component: <SettingsTab.KeyboardShortcuts />
    }
  ]

  return (
    <>
      <Group gap="sm" wrap="nowrap">
        {state.folders.length === 0 && (
          <Button
            variant="gradient"
            gradient={{ from: 'violet', to: 'cyan', deg: 90 }}
            onClick={open}
          >
            Add a folder to get started
          </Button>
        )}
        <Tooltip label="Manage settings">
          <Burger opened={opened} onClick={open} size="sm" aria-label="Manage settings" />
        </Tooltip>
      </Group>

      <Modal
        opened={opened}
        onClose={close}
        title={
          <Title order={1} size="h2">
            Settings
          </Title>
        }
        size="xl"
      >
        <Tabs orientation="vertical" defaultValue="library">
          <Tabs.List>
            {settingsTabs.map(({ label, value, icon }) => (
              <Tabs.Tab
                key={value}
                value={value}
                leftSection={icon}
                styles={{ tabLabel: { textAlign: 'left' } }}
              >
                {label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {settingsTabs.map(({ label, value, component }) => (
            <Tabs.Panel key={value} value={value} px="lg">
              <Stack gap="lg">
                <Title order={2} size="h3">
                  {label}
                </Title>
                {component}
              </Stack>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Modal>
    </>
  )
}
