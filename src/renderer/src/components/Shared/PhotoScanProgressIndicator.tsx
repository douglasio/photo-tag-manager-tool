import type { ReactElement } from 'react'

import { useScanProgress } from '@state'

import { ScanProgressIndicator } from './ScanProgressIndicator'

interface PhotoScanProgressIndicatorProps {
  label?: string
}

// Owns its own useScanProgress() subscription so a scan's ~150ms progress
// ticks re-render only this leaf, not whatever conditionally mounts it
// (DashboardView, GalleryGrid) — same reasoning as the AI/face scan toasts
// living in their own components instead of subscribing at a higher level.
export function PhotoScanProgressIndicator({
  label
}: PhotoScanProgressIndicatorProps): ReactElement {
  const { photoScanProgress } = useScanProgress()
  const percent =
    photoScanProgress && photoScanProgress.total > 0
      ? Math.round((photoScanProgress.done / photoScanProgress.total) * 100)
      : null
  return <ScanProgressIndicator percent={percent} label={label} />
}
