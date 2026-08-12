import { Button, Group, Stack, Title } from '@mantine/core'
import { IconLibraryPhoto, IconMoonStars, IconSun, IconSunrise } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { usePhotoLibrary } from '@state'
import { ACTION_ICONS, getGreeting, type Greeting } from '@utils'

const GREETING_ICONS: Record<Greeting, ReactElement> = {
  'Good morning': <IconSunrise size={ACTION_ICONS.GREETING_ICON_SIZE} />,
  'Good afternoon': <IconSun size={ACTION_ICONS.GREETING_ICON_SIZE} />,
  'Good evening': <IconMoonStars size={ACTION_ICONS.GREETING_ICON_SIZE} />
}

export function WelcomeWidget(): ReactElement {
  const { setActiveTab } = usePhotoLibrary()
  const greeting = getGreeting()

  return (
    <Stack justify="space-between" align="flex-start">
      <Group gap="xs" align="center">
        {GREETING_ICONS[greeting]}
        <Title order={1}>{greeting}</Title>
      </Group>
      <Button
        leftSection={<IconLibraryPhoto size={ACTION_ICONS.ICON_SIZE} />}
        onClick={() => setActiveTab('gallery')}
      >
        Go to Gallery
      </Button>
    </Stack>
  )
}
