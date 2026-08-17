import { type CSSProperties, type ReactElement, useState } from 'react'

import { Box, type MantineRadius } from '@mantine/core'

import { toThumbProtocolUrl } from '@shared/protocolUrls'
import type { FaceBox } from '@shared/types'

interface FaceCropThumbnailProps {
  thumbnailKey: string
  box: FaceBox
  // Square side in px — omit to fill 100% of the parent (e.g. inside an
  // AspectRatio square).
  size?: number
  radius?: MantineRadius
  className?: string
}

// Crops a face out of a photo's own thumbnail purely with CSS — no separate
// per-face image file exists, so this reuses the same thumbnail every face
// on that photo shares. Shared by DetailPanelFaces, the People panel, and
// the gallery's person-filter header.
//
// box.w/box.h are normalized against the photo's width and height
// *separately* (see FaceBox's own doc comment) — numerically equal doesn't
// mean square in real pixels unless the photo itself is square, so the crop
// math needs the image's actual pixel dimensions (known only once it loads)
// to pick a true square region. Without that, a non-square photo makes the
// crop non-square, which then gets stretched to fill this square container.
export function FaceCropThumbnail({
  thumbnailKey,
  box,
  size,
  radius = 0,
  className
}: FaceCropThumbnailProps): ReactElement {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)

  // Before the image loads (and we know its real aspect ratio), fall back to
  // a plain centered cover crop — never stretches, just not zoomed in yet.
  let imgStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: `${(box.x + box.w / 2) * 100}% ${(box.y + box.h / 2) * 100}%`
  }

  if (natural) {
    const boxPxW = box.w * natural.w
    const boxPxH = box.h * natural.h
    const side = Math.min(Math.max(boxPxW, boxPxH), Math.min(natural.w, natural.h))
    const centerXPx = (box.x + box.w / 2) * natural.w
    const centerYPx = (box.y + box.h / 2) * natural.h
    const cropX = Math.min(Math.max(centerXPx - side / 2, 0), natural.w - side)
    const cropY = Math.min(Math.max(centerYPx - side / 2, 0), natural.h - side)
    const scale = 100 / side

    imgStyle = {
      position: 'absolute',
      maxWidth: 'none',
      width: `${natural.w * scale}%`,
      height: `${natural.h * scale}%`,
      left: `${-cropX * scale}%`,
      top: `${-cropY * scale}%`
    }
  }

  return (
    <Box
      w={size ?? '100%'}
      h={size ?? '100%'}
      bdrs={radius}
      className={className}
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      <img
        src={toThumbProtocolUrl(thumbnailKey)}
        alt=""
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget
          setNatural({ w: naturalWidth, h: naturalHeight })
        }}
        style={imgStyle}
      />
    </Box>
  )
}
