import { Splitter } from '@mantine/core'
import type { ReactElement } from 'react'
import type { PhotoRecord } from '../../../../shared/types'
import { PannableZoomableImage } from './PannableZoomableImage'

interface CompareViewProps {
  photoA: PhotoRecord
  photoB: PhotoRecord
}

export function CompareView({ photoA, photoB }: CompareViewProps): ReactElement {
  return (
    <Splitter orientation="horizontal" h="100%" w="100%">
      <Splitter.Pane defaultSize="50%" min="5%">
        <PannableZoomableImage photo={photoA} />
      </Splitter.Pane>
      <Splitter.Pane defaultSize="50%" min="5%">
        <PannableZoomableImage photo={photoB} />
      </Splitter.Pane>
    </Splitter>
  )
}
