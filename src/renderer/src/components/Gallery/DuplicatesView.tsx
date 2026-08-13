import { type ReactElement, useEffect, useState } from 'react'

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Image,
  Loader,
  Progress,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip
} from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { IconFolderOpen, IconRefresh, IconTrash, IconX } from '@tabler/icons-react'

import { ConfirmDialog, EnableAiFeaturesDialog, GalleryHoverPreview } from '@components'
import { useHoverPreview, useKeyHeld } from '@hooks'
import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { DuplicateGroup, PhotoRecord } from '@shared/types'
import { usePhotoLibrary } from '@state'
import { aiScanStepLabel, formatDateModified, isMac, PREVIEW_TRIGGER_KEY } from '@utils'

const THUMB_SIZE = 96

// Caches the last scan result at module scope (outside the component) so
// reopening this tab within the same app session reuses it instead of
// re-running the scan and re-showing the "AI features ready" toast every
// time — reset only by an explicit "Scan again" or a full app restart.
let cachedResult: { groups: DuplicateGroup[]; canceled: boolean } | null = null

interface DuplicatePhotoRowProps {
  photo: PhotoRecord
  previewTriggerHeld: boolean
  motionEnabled: boolean
  onOpen: () => void
  onDeleted: () => void
}

// One photo within a duplicate group's card — thumbnail, filename, full
// filepath, and date modified all visible at a glance (no hover needed),
// plus per-photo actions.
function DuplicatePhotoRow({
  photo,
  previewTriggerHeld,
  motionEnabled,
  onOpen,
  onDeleted
}: DuplicatePhotoRowProps): ReactElement {
  const { deletePhotos } = usePhotoLibrary()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const canPreview = previewTriggerHeld && photo.thumbnailStatus === 'ready'
  const { position, onMouseMove, onMouseLeave } = useHoverPreview(canPreview)

  const handleDeleteConfirm = async (): Promise<void> => {
    setDeleting(true)
    try {
      await deletePhotos([photo.filePath])
      setConfirmingDelete(false)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Group wrap="nowrap" gap="md" align="center">
      <Box
        pos="relative"
        w={THUMB_SIZE}
        style={{ flexShrink: 0 }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {photo.thumbnailStatus === 'ready' && photo.thumbnailKey && (
          <Image
            src={toThumbProtocolUrl(photo.thumbnailKey)}
            alt={photo.fileName}
            w={THUMB_SIZE}
            h={THUMB_SIZE}
            fit="cover"
            radius="sm"
            style={{ cursor: canPreview ? 'zoom-in' : 'pointer' }}
            onClick={onOpen}
          />
        )}
        <GalleryHoverPreview
          photo={photo}
          position={canPreview ? position : null}
          scale={1}
          motionEnabled={motionEnabled}
        />
      </Box>
      <Stack gap={2} flex={1} miw={0}>
        <Text fw={600} truncate="end">
          {photo.fileName}
        </Text>
        <Text size="xs" c="dimmed" truncate="end" title={photo.filePath}>
          {photo.filePath}
        </Text>
        <Text size="xs" c="dimmed">
          Modified {formatDateModified(photo.mtimeMs)}
        </Text>
      </Stack>
      <Group gap={4} style={{ flexShrink: 0 }}>
        <Tooltip label={`Show in ${isMac ? 'Finder' : 'Explorer'}`}>
          <ActionIcon
            variant="subtle"
            onClick={() => window.api.showItemInFolder(photo.filePath)}
            aria-label={`Show ${photo.fileName} in folder`}
          >
            <IconFolderOpen size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Delete photo">
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${photo.fileName}`}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <ConfirmDialog
        title="Delete photo?"
        opened={confirmingDelete}
        saving={deleting}
        confirmLabel="Delete"
        confirmColor="red"
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setConfirmingDelete(false)}
      >
        <Text>This moves &quot;{photo.fileName}&quot; to the trash.</Text>
        <Text c="dimmed" mt="xs">
          You can restore it from your system&apos;s trash if needed.
        </Text>
      </ConfirmDialog>
    </Group>
  )
}

// Opened via the Gallery's "Show duplicates" button (see GalleryGrid) as its
// own tab — runs the shared AI scan on mount/recompute (via rescanAiFeatures,
// which also warms tag suggestions and Time Warp) and renders each resulting
// duplicate cluster as a card of actionable photo rows.
export function DuplicatesView(): ReactElement {
  const {
    state,
    rescanAiFeatures,
    enableAiFeatures,
    cancelAiScan,
    openPhotoTab,
    dismissDuplicateGroup
  } = usePhotoLibrary()
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(cachedResult?.groups ?? null)
  const [error, setError] = useState<string | null>(null)
  const [canceled, setCanceled] = useState(cachedResult?.canceled ?? false)
  const [scanCount, setScanCount] = useState(0)
  // Duplicate detection rides the same AI model/embeddings as tag
  // suggestions and Time Warp — gated the same way, rather than silently
  // downloading the model in the background the moment this tab opens.
  const [enableAiOpened, setEnableAiOpened] = useState(false)
  const previewTriggerHeld = useKeyHeld(PREVIEW_TRIGGER_KEY)
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = state.galleryAnimationsEnabled && !prefersReducedMotion

  // Adjust-during-render (not inside the effect below) the instant
  // "Scan again" bumps scanCount — same pattern useTagSuggestions uses to
  // reset state synchronously without triggering the set-state-in-effect lint rule.
  const [trackedScanCount, setTrackedScanCount] = useState(scanCount)
  if (trackedScanCount !== scanCount) {
    setTrackedScanCount(scanCount)
    setGroups(null)
    setError(null)
    setCanceled(false)
  }

  useEffect(() => {
    if (!state.aiTagSuggestionsEnabled) return
    // scanCount === 0 means this run is the initial mount rather than an
    // explicit "Scan again" — if a cached result already exists, reuse it
    // instead of re-running the scan (and re-showing its toast).
    if (scanCount === 0 && cachedResult) return
    let cancelled = false
    rescanAiFeatures()
      .then((result) => {
        if (cancelled) return
        setGroups(result.duplicateGroups)
        setCanceled(result.canceled)
        cachedResult = { groups: result.duplicateGroups, canceled: result.canceled }
      })
      .catch((err: unknown) => {
        console.error('failed to scan for duplicate photos', err)
        if (!cancelled) setError('Failed to scan for duplicate photos.')
      })
    return () => {
      cancelled = true
    }
  }, [rescanAiFeatures, scanCount, state.aiTagSuggestionsEnabled])

  // Shared by both a per-photo delete and a group dismiss — keeps the
  // module-level cache in sync so the change survives a tab revisit without
  // waiting for the next rescan.
  const updateGroups = (updater: (groups: DuplicateGroup[]) => DuplicateGroup[]): void => {
    setGroups((prev) => {
      if (!prev) return prev
      const next = updater(prev)
      if (cachedResult) cachedResult = { ...cachedResult, groups: next }
      return next
    })
  }

  // A group stops being a "duplicate" once only one photo is left in it.
  const handlePhotoDeleted = (group: DuplicateGroup, filePath: string): void => {
    updateGroups((current) =>
      current
        .map((g) =>
          g === group ? { ...g, filePaths: g.filePaths.filter((p) => p !== filePath) } : g
        )
        .filter((g) => g.filePaths.length > 1)
    )
  }

  const handleDismiss = (group: DuplicateGroup): void => {
    void dismissDuplicateGroup(group.filePaths)
    updateGroups((current) => current.filter((g) => g !== group))
  }

  if (!state.aiTagSuggestionsEnabled) {
    return (
      <Center flex={1} mih={0} p="md">
        <Stack align="center" gap="sm" w={360}>
          <Text ta="center" c="dimmed">
            Duplicate detection requires AI features to be enabled.
          </Text>
          <Button onClick={() => setEnableAiOpened(true)}>Enable AI features</Button>
        </Stack>
        <EnableAiFeaturesDialog
          opened={enableAiOpened}
          onCancel={() => setEnableAiOpened(false)}
          onConfirm={enableAiFeatures}
        />
      </Center>
    )
  }

  const progress = state.aiScanProgress
  const loading = groups === null && !error

  return (
    <Stack flex={1} mih={0} p="md">
      <Group justify="space-between" style={{ flexShrink: 0 }}>
        <Title order={2} size="h3">
          Duplicate Photos
        </Title>
        <Button
          leftSection={<IconRefresh size={14} />}
          variant="default"
          disabled={loading}
          onClick={() => setScanCount((count) => count + 1)}
        >
          Scan again
        </Button>
      </Group>

      {loading && (
        <Center flex={1} mih={0}>
          <Stack align="center" gap="xl" w={320}>
            {progress ? (
              <Stack align="center" gap="xs" w="100%">
                <Progress
                  value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
                  size="sm"
                  w="100%"
                  animated
                />
                <Text c="dimmed" size="sm">
                  {aiScanStepLabel(progress.phase)}
                </Text>
              </Stack>
            ) : (
              <Loader size="sm" />
            )}
            <Button variant="subtle" color="red" size="xs" onClick={cancelAiScan}>
              Cancel
            </Button>
          </Stack>
        </Center>
      )}

      {error && (
        <Box>
          <Alert display="inline-block" color="red" style={{ flexShrink: 0 }}>
            {error}
          </Alert>
        </Box>
      )}

      {groups && groups.length === 0 && (
        <Text c="dimmed" style={{ flexShrink: 0 }}>
          {canceled ? 'Scan canceled.' : 'No duplicates found.'}
        </Text>
      )}

      {groups && groups.length > 0 && (
        <ScrollArea flex={1} mih={0}>
          <Stack gap="md" pr="md">
            {groups.map((group) => (
              <Card key={group.filePaths.join('|')} withBorder>
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <Badge variant="light">{group.filePaths.length} photos</Badge>
                    <Badge variant="light" color="grape">
                      {Math.round(group.similarity * 100)}% similar
                    </Badge>
                  </Group>
                  <Tooltip label="Ignore these duplicates and dismiss">
                    <Button
                      variant="subtle"
                      color="gray"
                      size="compact-sm"
                      leftSection={<IconX size={14} />}
                      onClick={() => handleDismiss(group)}
                    >
                      Dismiss
                    </Button>
                  </Tooltip>
                </Group>
                <Stack gap="sm">
                  {group.filePaths.map((filePath) => {
                    const photo = state.photosByPath.get(filePath)
                    if (!photo) return null
                    return (
                      <DuplicatePhotoRow
                        key={filePath}
                        photo={photo}
                        previewTriggerHeld={previewTriggerHeld}
                        motionEnabled={motionEnabled}
                        onOpen={() => openPhotoTab(filePath)}
                        onDeleted={() => handlePhotoDeleted(group, filePath)}
                      />
                    )
                  })}
                </Stack>
              </Card>
            ))}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  )
}
