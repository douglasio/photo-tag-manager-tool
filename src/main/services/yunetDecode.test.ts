// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { decodeYuNetOutputs, intersectionOverUnion, type YuNetStrideOutput } from './yunetDecode'

const STRIDE = 8
const GRID = 2 // 2x2 grid, 4 cells

function emptyStrideOutput(): YuNetStrideOutput {
  return {
    stride: STRIDE,
    cols: GRID,
    rows: GRID,
    cls: new Float32Array(GRID * GRID),
    obj: new Float32Array(GRID * GRID),
    bbox: new Float32Array(GRID * GRID * 4),
    kps: new Float32Array(GRID * GRID * 10)
  }
}

// idx = r * cols + c, matching yunetDecode's own indexing.
function setCell(
  output: YuNetStrideOutput,
  r: number,
  c: number,
  {
    cls,
    obj,
    bboxOffset = [0, 0],
    logWH = [0, 0]
  }: { cls: number; obj: number; bboxOffset?: [number, number]; logWH?: [number, number] }
): void {
  const idx = r * output.cols + c
  output.cls[idx] = cls
  output.obj[idx] = obj
  output.bbox[idx * 4 + 0] = bboxOffset[0]
  output.bbox[idx * 4 + 1] = bboxOffset[1]
  output.bbox[idx * 4 + 2] = logWH[0]
  output.bbox[idx * 4 + 3] = logWH[1]
}

describe('intersectionOverUnion', () => {
  it('is 1 for identical boxes', () => {
    const box = { x: 0, y: 0, w: 10, h: 10, score: 1, landmarks: [] as [number, number][] }
    expect(intersectionOverUnion(box, box)).toBeCloseTo(1)
  })

  it('is 0 for disjoint boxes', () => {
    const a = { x: 0, y: 0, w: 10, h: 10, score: 1, landmarks: [] as [number, number][] }
    const b = { x: 100, y: 100, w: 10, h: 10, score: 1, landmarks: [] as [number, number][] }
    expect(intersectionOverUnion(a, b)).toBe(0)
  })
})

describe('decodeYuNetOutputs', () => {
  it("decodes a single above-threshold cell using OpenCV face_detect.cpp's formulas", () => {
    const output = emptyStrideOutput()
    // r=0, c=1 — cls*obj=1 => score=1, zero offsets/log-scale => predictable box.
    setCell(output, 0, 1, { cls: 1, obj: 1 })

    const faces = decodeYuNetOutputs([output], 0.6, 0.3)

    expect(faces).toHaveLength(1)
    const face = faces[0]
    // cx = (c + 0) * stride = 8, cy = (r + 0) * stride = 0
    // w = exp(0) * stride = 8, h = exp(0) * stride = 8
    expect(face.x).toBeCloseTo(4) // cx - w/2
    expect(face.y).toBeCloseTo(-4) // cy - h/2
    expect(face.w).toBeCloseTo(8)
    expect(face.h).toBeCloseTo(8)
    expect(face.score).toBeCloseTo(1)
    // landmark n = (kps[..]+c)*stride, (kps[..]+r)*stride) with zero kps => (c*stride, r*stride)
    expect(face.landmarks[0]).toEqual([8, 0])
  })

  it('drops cells below the score threshold', () => {
    const output = emptyStrideOutput()
    setCell(output, 0, 0, { cls: 0.5, obj: 0.5 }) // score = 0.5 < 0.6

    expect(decodeYuNetOutputs([output], 0.6, 0.3)).toHaveLength(0)
  })

  it('suppresses a lower-score box that heavily overlaps a higher-score one', () => {
    const output = emptyStrideOutput()
    // Both boxes sized 16x16 (log(2) => exp(log(2))=2, *stride 8 = 16),
    // centered at x=0 and x=8 respectively — IoU ≈ 0.33, above 0.3 threshold.
    setCell(output, 0, 0, { cls: 1, obj: 1, logWH: [Math.log(2), Math.log(2)] })
    setCell(output, 0, 1, { cls: 0.7, obj: 0.7, logWH: [Math.log(2), Math.log(2)] })

    const faces = decodeYuNetOutputs([output], 0.6, 0.3)

    expect(faces).toHaveLength(1)
    expect(faces[0].score).toBeCloseTo(1) // the higher-scoring box survived
  })

  it('keeps two non-overlapping above-threshold boxes', () => {
    const output = emptyStrideOutput()
    setCell(output, 0, 0, { cls: 1, obj: 1 })
    setCell(output, 1, 1, { cls: 1, obj: 1 })

    expect(decodeYuNetOutputs([output], 0.6, 0.3)).toHaveLength(2)
  })
})
