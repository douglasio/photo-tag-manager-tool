// Aligns a detected face to SFace's expected 112x112 input crop before
// embedding, using a 2-point (eye-to-eye) similarity transform — rotation +
// uniform scale + translation, no shear (simpler than FaceRecognizerSF's 5-point fit)

export const SFACE_INPUT_SIZE = 112

// match crop framing to what the model was trained on
const TEMPLATE_RIGHT_EYE = { x: 38.2946, y: 51.6963 }
const TEMPLATE_LEFT_EYE = { x: 73.5318, y: 51.5014 }

export interface Point {
  x: number
  y: number
}

export interface RawImage {
  data: Uint8Array | Buffer
  width: number
  height: number
  channels: number
}

function bilinearSample(image: RawImage, x: number, y: number, channel: number): number {
  const cx = Math.min(Math.max(x, 0), image.width - 1)
  const cy = Math.min(Math.max(y, 0), image.height - 1)
  const x0 = Math.floor(cx)
  const y0 = Math.floor(cy)
  const x1 = Math.min(x0 + 1, image.width - 1)
  const y1 = Math.min(y0 + 1, image.height - 1)
  const fx = cx - x0
  const fy = cy - y0

  const idx = (px: number, py: number): number => (py * image.width + px) * image.channels + channel

  const top = image.data[idx(x0, y0)] * (1 - fx) + image.data[idx(x1, y0)] * fx
  const bottom = image.data[idx(x0, y1)] * (1 - fx) + image.data[idx(x1, y1)] * fx
  return top * (1 - fy) + bottom * fy
}

/** Crops+warps `image` to a 112x112 RGB buffer aligned so rightEye/leftEye
 * land on SFace's expected template positions. Returns HWC Uint8 RGB. */
export function warpFaceCrop(image: RawImage, rightEye: Point, leftEye: Point): Uint8Array {
  const s = { x: leftEye.x - rightEye.x, y: leftEye.y - rightEye.y }
  const d = {
    x: TEMPLATE_LEFT_EYE.x - TEMPLATE_RIGHT_EYE.x,
    y: TEMPLATE_LEFT_EYE.y - TEMPLATE_RIGHT_EYE.y
  }
  const sLenSq = s.x * s.x + s.y * s.y || 1e-6

  // Complex-division similarity factor k mapping vector s onto vector d
  // (rotation + uniform scale in one step) — forward transform is
  // dst = k * (src - rightEye) + TEMPLATE_RIGHT_EYE.
  const kRe = (d.x * s.x + d.y * s.y) / sLenSq
  const kIm = (d.y * s.x - d.x * s.y) / sLenSq
  const kLenSq = kRe * kRe + kIm * kIm || 1e-6

  // Inverse (dst -> src), used below to backward-sample the source image
  // for every destination pixel.
  const invRe = kRe / kLenSq
  const invIm = -kIm / kLenSq

  const out = new Uint8Array(SFACE_INPUT_SIZE * SFACE_INPUT_SIZE * 3)
  for (let dy = 0; dy < SFACE_INPUT_SIZE; dy++) {
    for (let dx = 0; dx < SFACE_INPUT_SIZE; dx++) {
      const rx = dx - TEMPLATE_RIGHT_EYE.x
      const ry = dy - TEMPLATE_RIGHT_EYE.y
      const sx = rightEye.x + (invRe * rx - invIm * ry)
      const sy = rightEye.y + (invIm * rx + invRe * ry)

      const outIdx = (dy * SFACE_INPUT_SIZE + dx) * 3
      out[outIdx] = Math.round(bilinearSample(image, sx, sy, 0))
      out[outIdx + 1] = Math.round(bilinearSample(image, sx, sy, 1))
      out[outIdx + 2] = Math.round(bilinearSample(image, sx, sy, 2))
    }
  }
  return out
}
