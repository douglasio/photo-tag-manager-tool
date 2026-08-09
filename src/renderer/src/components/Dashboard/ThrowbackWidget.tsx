import { type ReactElement, useEffect, useRef, useState } from 'react'

import {
  Badge,
  Button,
  Group,
  Image,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Timeline
} from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { EnableAiFeaturesDialog } from '@components'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { ThrowbackEntry, ThrowbackYearSample } from '@shared/types'
import { usePhotoLibrary } from '@state'

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
                w={100}
                h={100}
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
//
// Time Warp rides the same shared AI scan as tag suggestions and duplicate
// detection — once AI features are enabled there's no separate "enable"
// step here at all, the timeline (or the year-sample fallback) just loads.
export function ThrowbackWidget(): ReactElement | null {
  const {
    state,
    getThrowbackSimilarity,
    getThrowbackYearSample,
    getThrowbackPreview,
    enableAiFeatures
  } = usePhotoLibrary()

  const [loading, setLoading] = useState(true)
  const [similarity, setSimilarity] = useState<ThrowbackEntry[] | null>(null)
  const [yearSample, setYearSample] = useState<ThrowbackYearSample | null>(null)
  const [previewEntries, setPreviewEntries] = useState<ThrowbackEntry[] | null>(null)
  const [enableAiOpened, setEnableAiOpened] = useState(false)
  // Only the very first fetch shows the loading spinner (see below) — once
  // it's flipped false, later refetches swap content in silently.
  const hasLoadedOnceRef = useRef(false)
  const scanning = state.aiScanProgress !== null

  // Re-fetches on scan start/finish, not just on mount, so a completed or
  // canceled scan can't leave this stuck on stale data. Skips the
  // similarity query entirely while AI is disabled (it isn't rendered then
  // anyway — see below) since it's the expensive half of this pair.
  useEffect(() => {
    let cancelled = false
    if (!hasLoadedOnceRef.current) setLoading(true)
    const similarityPromise = state.aiTagSuggestionsEnabled
      ? getThrowbackSimilarity()
      : Promise.resolve(null)
    Promise.all([similarityPromise, getThrowbackYearSample()])
      .then(([similarityResult, sampleResult]) => {
        if (cancelled) return
        setSimilarity(similarityResult)
        setYearSample(sampleResult)
      })
      .catch((err: unknown) => console.error('failed to load Throwback data', err))
      .finally(() => {
        if (cancelled) return
        hasLoadedOnceRef.current = true
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [getThrowbackSimilarity, getThrowbackYearSample, scanning, state.aiTagSuggestionsEnabled])

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

  if (loading) {
    return (
      <Group>
        <Loader size="sm" />
        <Text>Loading...</Text>
      </Group>
    )
  }

  // Gated on aiTagSuggestionsEnabled so disabling AI falls through to the
  // yearSample view below instead of showing stale AI-derived content.
  if (state.aiTagSuggestionsEnabled && similarity) return <ThrowbackTimeline entries={similarity} />

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
          {!state.aiTagSuggestionsEnabled && (
            <Button size="compact-sm" onClick={() => setEnableAiOpened(true)}>
              Enable Time Warp
            </Button>
          )}
          <Button size="compact-sm" variant="subtle" onClick={handlePreview}>
            Preview Time Warp
          </Button>
        </Group>
        <EnableAiFeaturesDialog
          opened={enableAiOpened}
          onCancel={() => setEnableAiOpened(false)}
          onConfirm={enableAiFeatures}
        />
      </Stack>
    )
  }

  return (
    <Text c="dimmed" size="sm">
      Add photos spanning more than one year to see Throwback.
    </Text>
  )
}
