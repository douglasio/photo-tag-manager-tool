import { type MouseEvent as ReactMouseEvent, useEffect, useState } from 'react'

import { useMotionTemplate, useMotionValue, useSpring } from 'motion/react'

import { PREVIEW_TRIGGER_KEY } from '@utils'

import { useKeyHeld } from './useKeyHeld'

// Hover saturates a soft, cursor-centered, feathered circle (a saturated
// image copy masked by a radial gradient) rather than zooming.
const SATURATION_RADIUS_PX = 270
const SATURATION_AMOUNT = 1.5
const SATURATION_SPRING = { stiffness: 300, damping: 30, mass: 0.5 } as const

// Holding the trigger key while hovering swaps the saturation effect for a
// pronounced cursor-zoom.
const TRIGGER_ZOOM_SCALE = 4
const TRIGGER_ZOOM_SPRING = { stiffness: 300, damping: 30, mass: 0.5 } as const

interface UsePhotoHoverEffectsResult {
  saturationAmount: number
  containerHandlers: {
    onMouseMove: (event: ReactMouseEvent<HTMLElement>) => void
    onMouseEnter: () => void
    onMouseLeave: () => void
  }
  zoomStyle: { scale: ReturnType<typeof useSpring>; transformOrigin: string }
  saturationOverlayStyle: {
    opacity: ReturnType<typeof useSpring>
    maskImage: ReturnType<typeof useMotionTemplate>
    WebkitMaskImage: ReturnType<typeof useMotionTemplate>
  }
}

// Drives PhotoView's two mutually-exclusive hover effects: a cursor-centered
// saturation mask by default, or a pronounced cursor-zoom while the preview
// trigger key is held.
export function usePhotoHoverEffects(motionEnabled: boolean): UsePhotoHoverEffectsResult {
  const maskX = useMotionValue(0)
  const maskY = useMotionValue(0)
  const maskOpacity = useMotionValue(0)
  const springMaskOpacity = useSpring(maskOpacity, SATURATION_SPRING)
  const maskImage = useMotionTemplate`radial-gradient(circle ${SATURATION_RADIUS_PX}px at ${maskX}px ${maskY}px, black 0%, black 35%, transparent 100%)`

  const triggerHeld = useKeyHeld(PREVIEW_TRIGGER_KEY)
  const [isHovering, setIsHovering] = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState('center center')
  const zoomScale = useMotionValue(1)
  const springZoomScale = useSpring(zoomScale, TRIGGER_ZOOM_SPRING)

  useEffect(() => {
    if (!motionEnabled) return
    if (isHovering && triggerHeld) {
      zoomScale.set(TRIGGER_ZOOM_SCALE)
      maskOpacity.set(0)
    } else {
      zoomScale.set(1)
    }
  }, [triggerHeld, isHovering, motionEnabled, zoomScale, maskOpacity])

  return {
    saturationAmount: SATURATION_AMOUNT,
    containerHandlers: {
      onMouseMove: (event) => {
        if (!motionEnabled) return
        const rect = event.currentTarget.getBoundingClientRect()
        const xPct = ((event.clientX - rect.left) / rect.width) * 100
        const yPct = ((event.clientY - rect.top) / rect.height) * 100
        setZoomOrigin(`${xPct}% ${yPct}%`)
        if (triggerHeld) {
          maskOpacity.set(0)
        } else {
          maskX.set(event.clientX - rect.left)
          maskY.set(event.clientY - rect.top)
          maskOpacity.set(1)
        }
      },
      onMouseEnter: () => {
        if (!motionEnabled) return
        setIsHovering(true)
        if (!triggerHeld) maskOpacity.set(1)
      },
      onMouseLeave: () => {
        setIsHovering(false)
        maskOpacity.set(0)
      }
    },
    zoomStyle: { scale: springZoomScale, transformOrigin: zoomOrigin },
    saturationOverlayStyle: {
      opacity: springMaskOpacity,
      maskImage,
      WebkitMaskImage: maskImage
    }
  }
}
