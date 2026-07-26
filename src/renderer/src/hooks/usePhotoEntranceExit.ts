import { useEffect, useRef, useState } from 'react'
import type { TargetAndTransition } from 'motion/react'
import type { NavigationDirection } from '../state/PhotoLibraryContext'

// A simple fade + slide crossfade — no scale/blur, just opacity and a small
// horizontal offset in the direction navigated from/to.
const SLIDE_X_PX = 48
const ENTRANCE_TRANSITION = { duration: 0.18, ease: 'easeOut' } as const

// Arrow-key nav remounts a fresh PhotoView, so there's no DOM node to
// cross-fade against — this plays a brief exit animation on the current
// photo first, then navigates once it finishes.
const EXIT_DURATION_S = 0.14
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
  transition: typeof ENTRANCE_TRANSITION | typeof EXIT_TRANSITION
  exitDirection: NavigationDirection | null
  handleImageLoad: () => void
  // Plays the exit animation, then calls onDone once it finishes. Returns
  // false (no-op) if an exit is already in progress.
  triggerExit: (direction: NavigationDirection, onDone: () => void) => boolean
}

function xFor(direction: NavigationDirection | null): number {
  if (direction === 'right') return SLIDE_X_PX
  if (direction === 'left') return -SLIDE_X_PX
  return 0
}

// Drives PhotoView's fade/slide entrance (gated on the image loading and the
// AppShell layout settling) and its arrow-key-navigation exit.
export function usePhotoEntranceExit({
  motionEnabled,
  enterDirection
}: UsePhotoEntranceExitOptions): UsePhotoEntranceExitResult {
  const [exitDirection, setExitDirection] = useState<NavigationDirection | null>(null)
  // Mirrors exitDirection for triggerExit's guard below. State alone isn't
  // enough there: during OS key-repeat, keydown events can fire faster than
  // React re-renders and re-subscribes the keydown listener, so a stale
  // closure could still see exitDirection as null and slip past the guard.
  // A ref is mutated in place and shared by every render's closure, so the
  // check stays correct regardless of that timing.
  const exitDirectionRef = useRef<NavigationDirection | null>(null)
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
    ? { x: xFor(enterDirection), opacity: 0 }
    : false

  const animate: TargetAndTransition = exitDirection
    ? { x: exitDirection === 'right' ? -SLIDE_X_PX : SLIDE_X_PX, opacity: 0 }
    : !motionEnabled || readyToAnimateIn
      ? { x: 0, opacity: 1 }
      : { x: xFor(enterDirection), opacity: 0 }

  const triggerExit = (direction: NavigationDirection, onDone: () => void): boolean => {
    if (exitDirectionRef.current) return false
    exitDirectionRef.current = direction
    setExitDirection(direction)
    exitTimeoutRef.current = setTimeout(onDone, EXIT_DURATION_S * 1000)
    return true
  }

  return {
    initial,
    animate,
    transition: exitDirection ? EXIT_TRANSITION : ENTRANCE_TRANSITION,
    exitDirection,
    handleImageLoad: () => setImageLoaded(true),
    triggerExit
  }
}
