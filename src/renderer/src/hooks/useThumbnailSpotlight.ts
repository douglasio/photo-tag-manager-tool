import type { TargetAndTransition } from 'motion/react'

// Spotlight hover effect: the hovered thumbnail scales up and saturates,
// while every other visible thumbnail dims and blurs — an "everything else
// fades away" effect. spotlighted/dimmed are computed by GalleryGrid from
// its single shared hoveredPath.
const SPOTLIGHT_SCALE = 1.1
const SPOTLIGHT_SATURATE = 1.3
const DIM_OPACITY = 0.55
const DIM_BLUR_PX = 3
const SPOTLIGHT_SPRING = { stiffness: 300, damping: 26, mass: 0.6 } as const
const SPOTLIGHT_VARIANTS: Record<'idle' | 'spotlighted' | 'dimmed', TargetAndTransition> = {
  idle: { scale: 1, opacity: 1, filter: 'blur(0px) saturate(1)' },
  spotlighted: {
    scale: SPOTLIGHT_SCALE,
    opacity: 1,
    filter: `blur(0px) saturate(${SPOTLIGHT_SATURATE})`
  },
  dimmed: { scale: 1, opacity: DIM_OPACITY, filter: `blur(${DIM_BLUR_PX}px) saturate(1)` }
}

interface UseThumbnailSpotlightResult {
  animate: TargetAndTransition
  transition: typeof SPOTLIGHT_SPRING
}

export function useThumbnailSpotlight(
  enabled: boolean,
  spotlighted: boolean,
  dimmed: boolean
): UseThumbnailSpotlightResult {
  const state = !enabled ? 'idle' : spotlighted ? 'spotlighted' : dimmed ? 'dimmed' : 'idle'
  return { animate: SPOTLIGHT_VARIANTS[state], transition: SPOTLIGHT_SPRING }
}
