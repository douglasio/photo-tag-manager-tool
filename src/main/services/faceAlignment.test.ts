// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { type RawImage, SFACE_INPUT_SIZE, warpFaceCrop } from './faceAlignment'

// The template's own right/left-eye positions (see faceAlignment.ts) — using
// them directly as the source eye positions makes the similarity transform
// the identity (no rotation/scale/translation), so the warp should just
// resample the source at the same pixel coordinates as the destination.
const TEMPLATE_RIGHT_EYE = { x: 38.2946, y: 51.6963 }
const TEMPLATE_LEFT_EYE = { x: 73.5318, y: 51.5014 }

function buildRampImage(size: number): RawImage {
  // R channel = x coordinate, G channel = y coordinate — a value at any
  // pixel is analytically known, so a resample can be checked exactly
  // (well, within bilinear-interpolation float tolerance for non-identity
  // cases; here the mapping is identity so no interpolation error at all).
  const channels = 3
  const data = new Uint8Array(size * size * channels)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * channels
      data[idx] = x % 256
      data[idx + 1] = y % 256
      data[idx + 2] = 0
    }
  }
  return { data, width: size, height: size, channels }
}

describe('warpFaceCrop', () => {
  it('produces a 112x112 RGB buffer', () => {
    const image = buildRampImage(200)
    const out = warpFaceCrop(image, TEMPLATE_RIGHT_EYE, TEMPLATE_LEFT_EYE)
    expect(out).toHaveLength(SFACE_INPUT_SIZE * SFACE_INPUT_SIZE * 3)
  })

  it('is the identity transform when source eyes already match the template', () => {
    const image = buildRampImage(200)
    const out = warpFaceCrop(image, TEMPLATE_RIGHT_EYE, TEMPLATE_LEFT_EYE)

    // Sample a handful of interior points (avoid edges, where clamping to
    // image bounds could interact with rounding) and confirm the output
    // pixel matches the source pixel at the same (dx, dy).
    for (const [dx, dy] of [
      [10, 10],
      [56, 56],
      [90, 20],
      [30, 90]
    ]) {
      const outIdx = (dy * SFACE_INPUT_SIZE + dx) * 3
      const srcIdx = (dy * image.width + dx) * image.channels
      expect(out[outIdx]).toBe(image.data[srcIdx])
      expect(out[outIdx + 1]).toBe(image.data[srcIdx + 1])
    }
  })

  it('shifts the sampled region when the source eyes are translated', () => {
    const image = buildRampImage(200)
    const shift = 20
    const out = warpFaceCrop(
      image,
      { x: TEMPLATE_RIGHT_EYE.x + shift, y: TEMPLATE_RIGHT_EYE.y },
      { x: TEMPLATE_LEFT_EYE.x + shift, y: TEMPLATE_LEFT_EYE.y }
    )

    const dx = 50
    const dy = 50
    const outIdx = (dy * SFACE_INPUT_SIZE + dx) * 3
    const srcIdx = (dy * image.width + (dx + shift)) * image.channels
    expect(out[outIdx]).toBe(image.data[srcIdx])
  })
})
