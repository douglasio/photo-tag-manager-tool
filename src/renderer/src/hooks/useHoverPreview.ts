import { useEffect, useRef, useState } from 'react'

export interface UseHoverPreviewResult {
  position: { x: number; y: number } | null
  onMouseMove: (event: { clientX: number; clientY: number }) => void
  onMouseLeave: () => void
}

// Cursor position for a floating preview centered on it. A ref mirrors the
// position on every hover move regardless of `enabled` (a ref write alone
// doesn't re-render), so the position is already known the instant `enabled`
// flips true — otherwise the preview couldn't appear until the next
// mouse-move after that.
export function useHoverPreview(enabled: boolean): UseHoverPreviewResult {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const positionRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (enabled && positionRef.current) setPosition(positionRef.current)
  }, [enabled])

  return {
    position,
    onMouseMove: (event) => {
      const pos = { x: event.clientX, y: event.clientY }
      positionRef.current = pos
      if (enabled) setPosition(pos)
    },
    onMouseLeave: () => {
      positionRef.current = null
      setPosition(null)
    }
  }
}
