import { type RefObject, useEffect, useRef, useState } from 'react'

import { PREVIEW_TRIGGER_KEY } from '@utils'

import { useKeyHeld } from './useKeyHeld'

const MIN_PREVIEW_SCALE = 0.5
const MAX_PREVIEW_SCALE = 6
// A typical wheel "notch" reports a deltaY of roughly 100, so this yields
// about a 0.15x change per notch — noticeable without feeling twitchy.
const PREVIEW_ZOOM_SENSITIVITY = 0.0015

function clampPreviewScale(value: number): number {
  return Math.min(MAX_PREVIEW_SCALE, Math.max(MIN_PREVIEW_SCALE, value))
}

interface UseGalleryPreviewZoomResult {
  previewTriggerHeld: boolean
  previewScale: number
}

// Trigger-key-held-and-scroll zoom for the floating photo preview
// (PhotoThumbnail) — holding the trigger key and scrolling over the grid
// adjusts previewScale, shared across whichever thumbnail is currently being
// previewed since it's lifted up here rather than local to each one.
export function useGalleryPreviewZoom(
  containerRef: RefObject<HTMLDivElement | null>
): UseGalleryPreviewZoomResult {
  const previewTriggerHeld = useKeyHeld(PREVIEW_TRIGGER_KEY)
  // A ref mirror of previewTriggerHeld so the native wheel listener below
  // (attached once) always reads the latest value without needing to
  // re-subscribe.
  const previewTriggerHeldRef = useRef(previewTriggerHeld)
  useEffect(() => {
    previewTriggerHeldRef.current = previewTriggerHeld
  }, [previewTriggerHeld])

  const [previewScale, setPreviewScale] = useState(1)

  // Reset the zoom once the trigger key is released, so the next preview
  // session starts fresh — adjusted during render (not a useEffect) per this
  // codebase's pattern for resetting state when an external value changes.
  const [wasTriggerHeld, setWasTriggerHeld] = useState(previewTriggerHeld)
  if (previewTriggerHeld !== wasTriggerHeld) {
    setWasTriggerHeld(previewTriggerHeld)
    if (!previewTriggerHeld) setPreviewScale(1)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // React's synthetic onWheel attaches its DOM listener as passive, so
    // event.preventDefault() inside it is silently ignored by the browser
    // (Chrome just logs a "preventDefault inside passive listener" warning)
    // and the grid keeps scrolling underneath the zoom. A manually attached
    // { passive: false } listener is the only way to actually cancel it.
    const handleWheel = (event: WheelEvent): void => {
      if (!previewTriggerHeldRef.current) return
      event.preventDefault()
      setPreviewScale((scale) => clampPreviewScale(scale - event.deltaY * PREVIEW_ZOOM_SENSITIVITY))
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [containerRef])

  return { previewTriggerHeld, previewScale }
}
