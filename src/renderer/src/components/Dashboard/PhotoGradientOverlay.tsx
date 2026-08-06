import { Overlay } from '@mantine/core'
import type { ReactElement } from 'react'

// Bottom-anchored gradient over a photo, deepening on hover via main.css's
// `.dashboard-photo-gradient` rule — parent needs the `dashboard-photo-frame` class.
export function PhotoGradientOverlay(): ReactElement {
  return (
    <Overlay
      className="dashboard-photo-gradient"
      gradient="linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.75) 100%)"
      zIndex={1}
    />
  )
}
