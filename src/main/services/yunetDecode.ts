// Pure decode/NMS math for YuNet's raw ONNX outputs, kept separate from the
// worker so it's unit-testable without a real ONNX runtime session. Ported
// directly from OpenCV's own C++ implementation (modules/objdetect/src/
// face_detect.cpp, FaceDetectorYNImpl::postProcess) rather than guessed —
// same score/bbox/landmark decode formulas, same greedy IoU NMS.

export interface YuNetStrideOutput {
  stride: number
  cols: number
  rows: number
  cls: Float32Array
  obj: Float32Array
  bbox: Float32Array
  kps: Float32Array
}

export interface DecodedFace {
  x: number
  y: number
  w: number
  h: number
  score: number
  // 5 points: right eye, left eye, nose tip, right mouth corner, left mouth
  // corner — same order YuNet's own landmark output uses.
  landmarks: [number, number][]
}

function decodeStride(output: YuNetStrideOutput, scoreThreshold: number): DecodedFace[] {
  const { stride, cols, rows, cls, obj, bbox, kps } = output
  const faces: DecodedFace[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      const clsScore = Math.min(Math.max(cls[idx], 0), 1)
      const objScore = Math.min(Math.max(obj[idx], 0), 1)
      const score = Math.sqrt(clsScore * objScore)
      if (score < scoreThreshold) continue

      const cx = (c + bbox[idx * 4]) * stride
      const cy = (r + bbox[idx * 4 + 1]) * stride
      const w = Math.exp(bbox[idx * 4 + 2]) * stride
      const h = Math.exp(bbox[idx * 4 + 3]) * stride
      const x = cx - w / 2
      const y = cy - h / 2

      const landmarks: [number, number][] = []
      for (let n = 0; n < 5; n++) {
        const lx = (kps[idx * 10 + 2 * n] + c) * stride
        const ly = (kps[idx * 10 + 2 * n + 1] + r) * stride
        landmarks.push([lx, ly])
      }
      faces.push({ x, y, w, h, score, landmarks })
    }
  }
  return faces
}

export function intersectionOverUnion(a: DecodedFace, b: DecodedFace): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  const interW = Math.max(0, x2 - x1)
  const interH = Math.max(0, y2 - y1)
  const inter = interW * interH
  const union = a.w * a.h + b.w * b.h - inter
  return union <= 0 ? 0 : inter / union
}

function nonMaxSuppression(faces: DecodedFace[], nmsThreshold: number): DecodedFace[] {
  const sorted = [...faces].sort((a, b) => b.score - a.score)
  const kept: DecodedFace[] = []
  for (const face of sorted) {
    if (kept.every((k) => intersectionOverUnion(face, k) <= nmsThreshold)) kept.push(face)
  }
  return kept
}

export function decodeYuNetOutputs(
  strideOutputs: YuNetStrideOutput[],
  scoreThreshold: number,
  nmsThreshold: number
): DecodedFace[] {
  const candidates = strideOutputs.flatMap((output) => decodeStride(output, scoreThreshold))
  return nonMaxSuppression(candidates, nmsThreshold)
}
