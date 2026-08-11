import { type ReactElement, useEffect, useRef, useState } from 'react'

import {
  Badge,
  Box,
  Button,
  Group,
  Image,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Timeline
} from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'

import { EnableAiFeaturesDialog, GalleryHoverPreview } from '@components'
import { useHoverPreview, useKeyHeld } from '@hooks'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord, ThrowbackEntry } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { PREVIEW_TRIGGER_KEY } from '@utils'

const PREVIEW_ENTRY_COUNT = 3
// Caps how tall the (real, vertical) Timeline can grow — a library spanning
// many years would otherwise make the widget grow to match.
const MAX_TIMELINE_ENTRIES = 5

interface ThrowbackTimelineProps {
  entries: ThrowbackEntry[]
}

interface TimelinePhotoTileProps {
  photo: PhotoRecord
  previewTriggerHeld: boolean
  motionEnabled: boolean
  onOpen: () => void
}

// Own hover-preview session per tile (mirrors RecentlyAddedWidget) — the
// Timeline has no single "currently hovered photo" to hang one shared
// preview off of.
function TimelinePhotoTile({
  photo,
  previewTriggerHeld,
  motionEnabled,
  onOpen
}: TimelinePhotoTileProps): ReactElement {
  const canPreview = previewTriggerHeld && photo.thumbnailStatus === 'ready'
  const { position, onMouseMove, onMouseLeave } = useHoverPreview(canPreview)

  return (
    <>
      <Image
        src={toThumbProtocolUrl(photo.thumbnailKey!)}
        alt={photo.fileName}
        w={200}
        h={200}
        fit="cover"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ cursor: canPreview ? 'zoom-in' : 'pointer' }}
        onClick={onOpen}
      />
      <GalleryHoverPreview
        photo={photo}
        position={canPreview ? position : null}
        scale={1}
        motionEnabled={motionEnabled}
      />
    </>
  )
}

// Confined to the widget's first column (see the 2-col SimpleGrid below) so
// a vertical Timeline doesn't stretch oddly across the widget's full width.
function ThrowbackTimeline({ entries }: ThrowbackTimelineProps): ReactElement {
  const { state, openPhotoTab } = usePhotoLibrary()
  const previewTriggerHeld = useKeyHeld(PREVIEW_TRIGGER_KEY)
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion

  return (
    <Timeline active={entries.length} bulletSize={16} lineWidth={2}>
      {entries.map((entry) => {
        const photo = state.photosByPath.get(entry.filePath)
        return (
          <Timeline.Item
            key={entry.year}
            opposite={
              <Text size="sm" fw={600} style={{ flexShrink: 0 }}>
                {entry.year}
              </Text>
            }
          >
            {photo?.thumbnailKey && (
              <TimelinePhotoTile
                photo={photo}
                previewTriggerHeld={previewTriggerHeld}
                motionEnabled={motionEnabled}
                onOpen={() => openPhotoTab(entry.filePath)}
              />
            )}
          </Timeline.Item>
        )
      })}
    </Timeline>
  )
}

// The AI-dependent half of the old ThrowbackWidget: one photo per year,
// picked because they look visually alike (see throwbackService). Rides the
// same shared AI scan as tag suggestions and duplicate detection — once
// enabled there's no separate "enable" step here, the timeline just loads.
export function TimeWarpWidget(): ReactElement {
  const { state, getThrowbackSimilarity, getThrowbackPreview, enableAiFeatures } = usePhotoLibrary()

  const [loading, setLoading] = useState(state.aiTagSuggestionsEnabled)
  const [similarity, setSimilarity] = useState<ThrowbackEntry[] | null>(null)
  const [previewEntries, setPreviewEntries] = useState<ThrowbackEntry[] | null>(null)
  const [enableAiOpened, setEnableAiOpened] = useState(false)
  const hasLoadedOnceRef = useRef(false)
  const scanning = state.aiScanProgress !== null
  const hasRealTimeline = state.aiTagSuggestionsEnabled && !!similarity && similarity.length > 0

  // Skips the query entirely while AI is disabled — the expensive half of
  // the old widget's pair, only worth running once features are on. The
  // render below re-gates on aiTagSuggestionsEnabled too, so a stale
  // `similarity` left over from AI being on earlier is never actually shown.
  useEffect(() => {
    if (!state.aiTagSuggestionsEnabled) return
    let cancelled = false
    if (!hasLoadedOnceRef.current) setLoading(true)
    getThrowbackSimilarity()
      .then((result) => {
        if (!cancelled) setSimilarity(result)
      })
      .catch((err: unknown) => console.error('failed to load Time Warp similarity', err))
      .finally(() => {
        if (cancelled) return
        hasLoadedOnceRef.current = true
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [getThrowbackSimilarity, scanning, state.aiTagSuggestionsEnabled])

  // Loads automatically (no button) whenever there's no real timeline to
  // show instead — whether that's because AI is off, or because AI is on
  // but no cross-year matches were found. Waits for `loading` to settle
  // first, since `similarity` is still null while that fetch is in flight.
  useEffect(() => {
    if (loading || hasRealTimeline) return
    let cancelled = false
    getThrowbackPreview()
      .then((result) => {
        if (!cancelled) setPreviewEntries(result)
      })
      .catch((err: unknown) => console.error('failed to load the Time Warp preview', err))
    return () => {
      cancelled = true
    }
  }, [getThrowbackPreview, loading, hasRealTimeline])

  if (loading) {
    return (
      <Group>
        <Loader size="sm" />
        <Text>Loading...</Text>
      </Group>
    )
  }

  if (hasRealTimeline) {
    return (
      <SimpleGrid cols={2}>
        <ThrowbackTimeline entries={similarity!.slice(0, MAX_TIMELINE_ENTRIES)} />
      </SimpleGrid>
    )
  }

  return (
    <Stack gap="lg" align="flex-start" w="100%">
      <Text c="dimmed" size="sm">
        {state.aiTagSuggestionsEnabled
          ? 'No cross-year matches found yet.'
          : 'Enable AI features to see photos matched across the years by visual similarity.'}
      </Text>
      {!state.aiTagSuggestionsEnabled && (
        <Button onClick={() => setEnableAiOpened(true)}>Enable AI Features</Button>
      )}
      {previewEntries && previewEntries.length > 0 && (
        <Box w="100%">
          <Badge size="lg" variant="outline" mb={4}>
            Preview
          </Badge>
          <SimpleGrid cols={2} style={{ opacity: 0.5 }}>
            <ThrowbackTimeline entries={previewEntries.slice(0, PREVIEW_ENTRY_COUNT)} />
          </SimpleGrid>
        </Box>
      )}
      <EnableAiFeaturesDialog
        opened={enableAiOpened}
        onCancel={() => setEnableAiOpened(false)}
        onConfirm={enableAiFeatures}
      />
    </Stack>
  )
}
