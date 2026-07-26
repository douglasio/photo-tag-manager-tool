import { Splitter } from '@mantine/core'
import type { ReactElement } from 'react'
import type { PhotoRecord } from '../../../../shared/types'
import { usePannableZoom } from '../../hooks/usePannableZoom'
import { PannableZoomableImage } from '../Shared/PannableZoomableImage'

interface CompareViewProps {
  photoA: PhotoRecord
  photoB: PhotoRecord
}

export function CompareView({ photoA, photoB }: CompareViewProps): ReactElement {
  const zoomA = usePannableZoom(photoA)
  const zoomB = usePannableZoom(photoB)

  return (
    <Splitter orientation="horizontal" h="100%" w="100%">
      <Splitter.Pane defaultSize="50%" min="5%">
        <PannableZoomableImage photo={photoA} zoom={zoomA} />
      </Splitter.Pane>
      <Splitter.Pane defaultSize="50%" min="5%">
        <PannableZoomableImage photo={photoB} zoom={zoomB} />
      </Splitter.Pane>
    </Splitter>
  )
}
