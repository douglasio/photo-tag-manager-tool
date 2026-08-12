import { createContext, type ReactElement, type ReactNode, type RefObject, useContext } from 'react'

import { useGalleryPreviewZoom } from '@hooks'

const DashboardPreviewScaleContext = createContext(1)

// Mirrors the gallery's trigger-key-held-and-scroll zoom for each widget's
// own floating photo preview — scoped per widget (via its own containerRef)
// rather than shared globally, since scrolling over one widget shouldn't
// zoom a preview hovered over a different one.
// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider by design
export function useDashboardPreviewScale(): number {
  return useContext(DashboardPreviewScaleContext)
}

interface DashboardPreviewZoomProviderProps {
  containerRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}

export function DashboardPreviewZoomProvider({
  containerRef,
  children
}: DashboardPreviewZoomProviderProps): ReactElement {
  const { previewScale } = useGalleryPreviewZoom(containerRef)
  return (
    <DashboardPreviewScaleContext.Provider value={previewScale}>
      {children}
    </DashboardPreviewScaleContext.Provider>
  )
}
