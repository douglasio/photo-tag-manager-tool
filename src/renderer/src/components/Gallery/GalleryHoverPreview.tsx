import { Box, Image, Portal } from '@mantine/core'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactElement } from 'react'

import { toFileProtocolUrl } from '@shared/protocolUrls'
import type { PhotoRecord } from '@shared/types'

// Size at scale === 1, in viewport-relative units so it scales with the window.
const BASE_WIDTH_VW = 50
const BASE_HEIGHT_VH = 70
const TRANSITION = { duration: 0.12, ease: 'easeOut' } as const

interface GalleryHoverPreviewProps {
  photo: PhotoRecord
  // null hides the preview. Kept as a prop (not derived here) so the caller
  // decides when it's actually eligible to show (thumbnail ready, trigger
  // key held, etc).
  position: { x: number; y: number } | null
  scale: number
  motionEnabled: boolean
}

// Floating cursor-centered preview shown while hovering a gallery thumbnail
// with the preview trigger held. Portaled to escape the thumbnail's own
// clipping/stacking context; AnimatePresence plays a fade/scale in and out
// around `position` toggling between a value and null.
export function GalleryHoverPreview({
  photo,
  position,
  scale,
  motionEnabled
}: GalleryHoverPreviewProps): ReactElement {
  return (
    <AnimatePresence>
      {position && (
        <Portal key="preview">
          <Box
            pos="fixed"
            left={position.x}
            top={position.y}
            style={{
              transform: 'translate(-50%, -50%)',
              // Sits directly under the cursor, so it must never intercept
              // pointer events — that would immediately trigger a "leave".
              pointerEvents: 'none',
              zIndex: 'var(--mantine-z-index-max)'
            }}
          >
            <motion.div
              initial={motionEnabled ? { opacity: 0, scale: 0.92 } : false}
              animate={{ opacity: 1, scale: 1 }}
              exit={motionEnabled ? { opacity: 0, scale: 0.92 } : undefined}
              transition={TRANSITION}
              style={{
                backgroundColor: 'var(--mantine-color-body)',
                borderRadius: 'var(--mantine-radius-md)',
                boxShadow: 'var(--mantine-shadow-elevated)'
              }}
            >
              <Image
                src={toFileProtocolUrl(photo.filePath, photo.thumbnailKey)}
                alt={photo.fileName}
                bdrs="md"
                fit="contain"
                maw={`min(${BASE_WIDTH_VW * scale}vw, 92vw)`}
                mah={`min(${BASE_HEIGHT_VH * scale}vh, 92vh)`}
                w="auto"
                h="auto"
              />
            </motion.div>
          </Box>
        </Portal>
      )}
    </AnimatePresence>
  )
}
