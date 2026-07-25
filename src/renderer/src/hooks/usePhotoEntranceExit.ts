import { useEffect, useRef, useState } from 'react'
import type { TargetAndTransition } from 'motion/react'
import type { NavigationDirection } from '../state/PhotoLibraryContext'

// Entrance: scale/blur only, coming into focus along the z-axis. An x-axis
// slide is layered on top only for arrow-key navigation (enterDirection).
const ENTRANCE_SCALE_FROM = 1.08
const ENTRANCE_BLUR_FROM_PX = 5
const ENTRANCE_X_FROM_PX = 100
const ENTRANCE_SPRING = { stiffness: 300, damping: 24, mass: 0.6 } as const

// Arrow-key nav remounts a fresh PhotoView, so there's no DOM node to
// cross-fade against — this plays a brief exit animation on the current
// photo first, then navigates once it finishes.
const EXIT_DURATION_S = 0.16
const EXIT_SCALE_TO = 0.94
const EXIT_BLUR_TO_PX = 8
const EXIT_TRANSITION = { duration: EXIT_DURATION_S, ease: 'easeIn' } as const

// Opening a photo tab also collapses the Navbar/Aside via AppShell's own
// 200ms transition — wait for that before starting the entrance animation.
const APP_SHELL_SETTLE_MS = 200

interface UsePhotoEntranceExitOptions {
  motionEnabled: boolean
  enterDirection: NavigationDirection | null
}

interface UsePhotoEntranceExitResult {
  initial: TargetAndTransition | false
  animate: TargetAndTransition
  transition: typeof ENTRANCE_SPRING | typeof EXIT_TRANSITION
  exitDirection: NavigationDirection | null
  handleImageLoad: () => void
  // Plays the exit animation, then calls onDone once it finishes. Returns
  // false (no-op) if an exit is already in progress.
  triggerExit: (direction: NavigationDirection, onDone: () => void) => boolean
}

function xFor(direction: NavigationDirection | null): number {
  if (direction === 'right') return ENTRANCE_X_FROM_PX
  if (direction === 'left') return -ENTRANCE_X_FROM_PX
  return 0
}

// Drives PhotoView's scale/blur/slide entrance (gated on the image loading
// and the AppShell layout settling) and its arrow-key-navigation exit.
export function usePhotoEntranceExit({
  motionEnabled,
  enterDirection
}: UsePhotoEntranceExitOptions): UsePhotoEntranceExitResult {
  const [exitDirection, setExitDirection] = useState<NavigationDirection | null>(null)
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current)
    },
    []
  )

  const [imageLoaded, setImageLoaded] = useState(false)
  const [layoutSettled, setLayoutSettled] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setLayoutSettled(true), APP_SHELL_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [])
  const readyToAnimateIn = imageLoaded && layoutSettled

  const initial: TargetAndTransition | false = motionEnabled
    ? {
        scale: ENTRANCE_SCALE_FROM,
        x: xFor(enterDirection),
        filter: `blur(${ENTRANCE_BLUR_FROM_PX}px)`,
        opacity: 1
      }
    : false

  const animate: TargetAndTransition = exitDirection
    ? {
        scale: EXIT_SCALE_TO,
        x: exitDirection === 'right' ? -ENTRANCE_X_FROM_PX : ENTRANCE_X_FROM_PX,
        filter: `blur(${EXIT_BLUR_TO_PX}px)`,
        opacity: 0
      }
    : !motionEnabled || readyToAnimateIn
      ? { scale: 1, x: 0, filter: 'blur(0px)', opacity: 1 }
      : {
          scale: ENTRANCE_SCALE_FROM,
          x: xFor(enterDirection),
          filter: `blur(${ENTRANCE_BLUR_FROM_PX}px)`,
          opacity: 1
        }

  const triggerExit = (direction: NavigationDirection, onDone: () => void): boolean => {
    if (exitDirection) return false
    setExitDirection(direction)
    exitTimeoutRef.current = setTimeout(onDone, EXIT_DURATION_S * 1000)
    return true
  }

  return {
    initial,
    animate,
    transition: exitDirection ? EXIT_TRANSITION : ENTRANCE_SPRING,
    exitDirection,
    handleImageLoad: () => setImageLoaded(true),
    triggerExit
  }
}
