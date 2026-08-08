import { type ReactElement, useEffect, useRef, useState } from 'react'

import { Badge, Button, Group, Image, SimpleGrid, Stack, Text, Timeline } from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { ConfirmDialog } from '@components'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { ThrowbackEntry, ThrowbackYearSample } from '@shared/types'
import { usePhotoLibrary } from '@state'

import { TimeWarpProgressToast } from './TimeWarpProgressToast'

const TIME_WARP_NOTIFICATION_ID = 'time-warp-scan'
const THUMB_SIZE = 100

interface ThrowbackTimelineProps {
  entries: ThrowbackEntry[]
}

function ThrowbackTimeline({ entries }: ThrowbackTimelineProps): ReactElement {
  const { state, openPhotoTab } = usePhotoLibrary()

  return (
    <Timeline active={entries.length} bulletSize={16} lineWidth={2}>
      {entries.map((entry) => {
        const photo = state.photosByPath.get(entry.filePath)
        return (
          <Timeline.Item key={entry.year} title={String(entry.year)}>
            {photo?.thumbnailKey && (
              <Image
                src={toThumbProtocolUrl(photo.thumbnailKey)}
                alt={photo.fileName}
                w={THUMB_SIZE}
                h={THUMB_SIZE}
                fit="cover"
                radius="sm"
                style={{ cursor: 'pointer' }}
                onClick={() => openPhotoTab(entry.filePath)}
              />
            )}
          </Timeline.Item>
        )
      })}
    </Timeline>
  )
}

// Dashboard widget pairing "on this day" nostalgia with cross-year visual
// similarity: shows one photo per year, picked because they look alike
// (same subject/scene, loosely), wherever the cache already supports that —
// see throwbackService for the actual selection logic. Falls back to a
// random sample from a single past year when nothing qualifies yet.
export function ThrowbackWidget(): ReactElement | null {
  const {
    state,
    getThrowbackSimilarity,
    getThrowbackYearSample,
    getThrowbackPreview,
    embedLibrary,
    cancelEmbedLibrary
  } = usePhotoLibrary()

  const [loading, setLoading] = useState(true)
  const [similarity, setSimilarity] = useState<ThrowbackEntry[] | null>(null)
  const [yearSample, setYearSample] = useState<ThrowbackYearSample | null>(null)
  const [previewEntries, setPreviewEntries] = useState<ThrowbackEntry[] | null>(null)
  const [confirmOpened, setConfirmOpened] = useState(false)

  const canceledRef = useRef(false)
  const notificationShownRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    getThrowbackSimilarity()
      .then(async (result) => {
        if (cancelled) return
        if (result) {
          setSimilarity(result)
        } else {
          const sample = await getThrowbackYearSample()
          if (!cancelled) setYearSample(sample)
        }
      })
      .catch((err: unknown) => console.error('failed to load Throwback data', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [getThrowbackSimilarity, getThrowbackYearSample])

  // Drives the scan-progress toast as state.embedLibraryProgress changes —
  // shown once on the first progress tick, updated in place after that.
  useEffect(() => {
    const progress = state.embedLibraryProgress
    if (!progress) return
    const handleCancel = (): void => {
      canceledRef.current = true
      cancelEmbedLibrary()
    }
    const message = (
      <TimeWarpProgressToast done={progress.done} total={progress.total} onCancel={handleCancel} />
    )
    if (!notificationShownRef.current) {
      notificationShownRef.current = true
      notifications.show({
        id: TIME_WARP_NOTIFICATION_ID,
        loading: true,
        autoClose: false,
        withCloseButton: true,
        onClose: handleCancel,
        message
      })
    } else {
      notifications.update({ id: TIME_WARP_NOTIFICATION_ID, message })
    }
  }, [state.embedLibraryProgress, cancelEmbedLibrary])

  const handleEnableTimeWarp = (): void => {
    setConfirmOpened(false)
    canceledRef.current = false
    notificationShownRef.current = false
    embedLibrary()
      .then(async () => {
        notifications.update({
          id: TIME_WARP_NOTIFICATION_ID,
          loading: false,
          color: canceledRef.current ? 'yellow' : 'teal',
          autoClose: 4000,
          message: canceledRef.current
            ? 'Time Warp scan canceled.'
            : 'Time Warp enabled — your library has been scanned.'
        })
        const result = await getThrowbackSimilarity()
        if (result) setSimilarity(result)
      })
      .catch((err: unknown) => {
        console.error('failed to run the Time Warp library scan', err)
        notifications.update({
          id: TIME_WARP_NOTIFICATION_ID,
          loading: false,
          color: 'red',
          autoClose: 4000,
          message: 'Something went wrong scanning your library.'
        })
      })
  }

  const handlePreview = (): void => {
    getThrowbackPreview()
      .then((result) => {
        if (result) {
          setPreviewEntries(result)
        } else {
          notifications.show({
            color: 'yellow',
            message: 'Not enough years of photos yet to preview Time Warp.'
          })
        }
      })
      .catch((err: unknown) => console.error('failed to load the Time Warp preview', err))
  }

  if (loading) return null

  if (similarity) return <ThrowbackTimeline entries={similarity} />

  if (previewEntries) {
    return (
      <Stack gap="xs">
        <Group gap="xs">
          <Badge color="grape" variant="light">
            Preview
          </Badge>
          <Text size="xs" c="dimmed">
            Random photos, not real matches
          </Text>
        </Group>
        <ThrowbackTimeline entries={previewEntries} />
        <Button variant="subtle" size="compact-sm" onClick={() => setPreviewEntries(null)}>
          Back
        </Button>
      </Stack>
    )
  }

  if (yearSample) {
    return (
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Photos from {yearSample.year}
        </Text>
        <SimpleGrid cols={4} spacing="xs">
          {yearSample.filePaths.map((filePath) => {
            const photo = state.photosByPath.get(filePath)
            if (!photo?.thumbnailKey) return null
            return (
              <Image
                key={filePath}
                src={toThumbProtocolUrl(photo.thumbnailKey)}
                alt={photo.fileName}
                radius="sm"
                fit="cover"
              />
            )
          })}
        </SimpleGrid>
        <Group gap="xs">
          <Button size="compact-sm" onClick={() => setConfirmOpened(true)}>
            Enable Time Warp
          </Button>
          <Button size="compact-sm" variant="subtle" onClick={handlePreview}>
            Preview Time Warp
          </Button>
        </Group>
        <ConfirmDialog
          title="Enable Time Warp?"
          opened={confirmOpened}
          saving={false}
          confirmLabel="Scan library"
          onConfirm={handleEnableTimeWarp}
          onCancel={() => setConfirmOpened(false)}
        >
          <Text size="sm">
            This scans your whole library in the background to find photos that look similar across
            different years. It can take a while on a large library, but runs off the main app
            thread and won&apos;t block you from working — you can cancel it any time from the
            progress notification.
          </Text>
        </ConfirmDialog>
      </Stack>
    )
  }

  return (
    <Text c="dimmed" size="sm">
      Add photos spanning more than one year to see Throwback.
    </Text>
  )
}
