import { Button, Group, Popover, RingProgress, Text, Tooltip } from '@mantine/core'
import { useDisclosure, useHover } from '@mantine/hooks'
import { IconCheck, IconX } from '@tabler/icons-react'
import { useEffect, useState, type ReactElement } from 'react'
import { usePhotoLibrary } from '../state/PhotoLibraryContext'
import { ScanLogContent } from './ScanLogContent'

// How long the "just synced" checkmark stays green before fading to a
// neutral gray, so a fresh completion is noticeable without lingering.
const FRESH_COMPLETE_MS = 4000

export function ScanProgressBar(): ReactElement | null {
  const { state, cancelScan } = usePhotoLibrary()
  const [logOpened, { toggle: toggleLog, close: closeLog }] = useDisclosure(false)
  const { hovered, ref } = useHover<HTMLButtonElement>()
  const [freshlyCompleted, setFreshlyCompleted] = useState(false)

  // Detect the transition into 'complete' during render (React's sanctioned way
  // to adjust state when a prop/value changes) — the effect below only ever
  // schedules the fade-out timer, never sets state synchronously itself.
  const [prevStatus, setPrevStatus] = useState(state.status)
  if (state.status !== prevStatus) {
    setPrevStatus(state.status)
    if (state.status === 'complete') setFreshlyCompleted(true)
  }

  useEffect(() => {
    if (!freshlyCompleted) return
    const timer = setTimeout(() => setFreshlyCompleted(false), FRESH_COMPLETE_MS)
    return () => clearTimeout(timer)
  }, [freshlyCompleted])

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
              {state.status === 'complete' &&
                (state.errors.length > 0 ? (
                  <Group gap={4} wrap="nowrap">
                    <IconX size={14} color="var(--mantine-color-red-6)" />
                    <Text c="dimmed">
                      {state.errors.length} error{state.errors.length === 1 ? '' : 's'}
                    </Text>
                  </Group>
                ) : (
                  <Tooltip label={`${processed} photos successfully synced with file system`}>
                    <Group gap={4} wrap="nowrap">
                      <IconCheck
                        size={14}
                        color={
                          freshlyCompleted
                            ? 'var(--mantine-color-teal-6)'
                            : 'var(--mantine-color-dimmed)'
                        }
                        style={{ transition: 'color 800ms ease' }}
                      />
                      <Text c="dimmed">Synced</Text>
                    </Group>
                  </Tooltip>
                ))}
              {state.status === 'canceled' && (
                <Text c="dimmed">Scan canceled ({processed} loaded)</Text>
              )}
            </Group>
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <ScanLogContent onRescan={closeLog} />
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
