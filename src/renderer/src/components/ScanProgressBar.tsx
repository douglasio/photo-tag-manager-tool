import { Button, Group, Popover, RingProgress, Text } from '@mantine/core'
import { useDisclosure, useHover } from '@mantine/hooks'
import type { ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { ScanLogContent } from './ScanLogContent'

export function ScanProgressBar(): ReactElement | null {
  const { state, cancelScan } = usePhotoLibrary()
  const [logOpened, { toggle: toggleLog, close: closeLog }] = useDisclosure(false)
  const { hovered, ref } = useHover<HTMLButtonElement>()

  if (state.status === 'idle') return null

  const processed = state.photosByPath.size
  const total = state.filesFound
  const percent = total ? Math.round((processed / total) * 100) : 0

  return (
    <Group gap="sm" wrap="nowrap">
      <Popover
        opened={logOpened}
        onChange={(value) => {
          if (!value) closeLog()
        }}
        position="bottom"
        withArrow
        shadow="md"
      >
        <Popover.Target>
          <Button
            ref={ref}
            onClick={toggleLog}
            px="xs"
            py={4}
            bg={hovered ? 'var(--mantine-color-default-hover)' : undefined}
            variant="transparent"
          >
            <Group gap="sm" wrap="nowrap">
              {state.status === 'scanning' && (
                <>
                  <RingProgress
                    size={44}
                    thickness={4}
                    roundCaps
                    sections={[{ value: percent, color: 'indigo' }]}
                    label={
                      <Text size="8px" ta="center" fw={700}>
                        {processed}/{total || '…'}
                      </Text>
                    }
                  />
                  <Text c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {processed} / {total || '…'} found
                  </Text>
                </>
              )}
              {state.status === 'complete' && (
                <Text c="dimmed">
                  Done — {total} photos
                  {state.errors.length > 0 && `, ${state.errors.length} error(s)`}
                </Text>
              )}
              {state.status === 'canceled' && (
                <Text c="dimmed">Scan canceled ({processed} loaded)</Text>
              )}
            </Group>
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <ScanLogContent />
        </Popover.Dropdown>
      </Popover>
      {state.status === 'scanning' && (
        <Button variant="subtle" color="red" onClick={() => void cancelScan()}>
          Cancel
        </Button>
      )}
    </Group>
  )
}
