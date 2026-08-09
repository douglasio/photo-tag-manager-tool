import { type ReactElement, useEffect, useRef, useState } from 'react'

import { Progress, Stack, Text } from '@mantine/core'

import { ConfirmDialog } from '@components'
import type { AiScanResult } from '@shared/types'
import { usePhotoLibrary } from '@state'

interface EnableAiFeaturesDialogProps {
  opened: boolean
  onCancel: () => void
  onConfirm: () => Promise<AiScanResult>
}

/** Shared "turn on AI features" confirmation — replaces the near-duplicate
 * dialogs that used to live separately in ThrowbackWidget and DuplicatesView.
 * Shows the model-download sub-progress while it's running, then closes
 * itself once downloading finishes — the scan that follows (embedding,
 * clustering) is tracked by the global toast instead of this modal staying
 * open for the whole thing. */
export function EnableAiFeaturesDialog({
  opened,
  onCancel,
  onConfirm
}: EnableAiFeaturesDialogProps): ReactElement {
  const { state } = usePhotoLibrary()
  const [error, setError] = useState<string | null>(null)
  const downloading = state.aiScanProgress?.phase === 'downloading'
  // Tracks whether *this* dialog actually kicked off a download, so the
  // close-on-transition effect below can't fire the instant the dialog
  // opens (when aiScanProgress is still null from a previous, unrelated
  // idle state) — only once it's seen 'downloading' at least once.
  const downloadStartedRef = useRef(false)
  // A genuine download failure also drives aiScanProgress back to null
  // (runFullAiScan's finally runs before the rejection reaches this
  // component), the same signal success/cancel use to close this dialog —
  // without this, the effect below would close the dialog out from under
  // its own error message before the user ever sees it. A ref (not the
  // `error` state) so it's guaranteed to be set before the effect can react
  // to that same rejection, regardless of how React batches the two updates.
  const hadErrorRef = useRef(false)

  useEffect(() => {
    if (!opened) {
      downloadStartedRef.current = false
      hadErrorRef.current = false
      return
    }
    if (downloading) {
      downloadStartedRef.current = true
      return
    }
    // Covers both outcomes once a download it kicked off has moved on: the
    // scan progressing past 'downloading' (success), and aiScanProgress
    // going back to null (canceled) — either way this dialog's job is done
    // and the global toast takes over. A real failure is excluded so its
    // error message stays visible instead of auto-closing.
    if (downloadStartedRef.current && !hadErrorRef.current) {
      onCancel()
    }
  }, [opened, downloading, onCancel])

  const handleConfirm = (): void => {
    setError(null)
    hadErrorRef.current = false
    onConfirm().catch((err: unknown) => {
      console.error('failed to enable AI features', err)
      hadErrorRef.current = true
      setError('Failed to download the AI model. Check your connection and try again.')
    })
  }

  return (
    <ConfirmDialog
      title="Enable AI features?"
      opened={opened}
      saving={downloading}
      confirmLabel="Enable AI features"
      onConfirm={handleConfirm}
      onCancel={onCancel}
    >
      <Text size="sm">
        This downloads a small on-device model (~50-90MB) the first time, then scans your library
        for tag suggestions, duplicate detection, and Time Warp all at once — everything happens
        automatically once you confirm. Runs fully offline afterward.
      </Text>
      {downloading && state.aiScanProgress && (
        <Stack gap={4} mt="sm">
          <Progress value={state.aiScanProgress.done} animated />
          <Text size="xs" c="dimmed">
            Downloading model… {Math.round(state.aiScanProgress.done)}%
          </Text>
        </Stack>
      )}
      {error && (
        <Text size="xs" c="red" mt="sm">
          {error}
        </Text>
      )}
    </ConfirmDialog>
  )
}
