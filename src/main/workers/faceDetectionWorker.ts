import { parentPort } from 'node:worker_threads'
import * as ort from 'onnxruntime-node'
import sharp from 'sharp'

import { type RawImage, warpFaceCrop } from '@main/services/faceAlignment'
import { decodeYuNetOutputs, type YuNetStrideOutput } from '@main/services/yunetDecode'
import type { FaceBox } from '@shared/types'

import type { DetectedFace, WorkerRequest, WorkerResponse } from './faceDetectionProtocol'

if (!parentPort) throw new Error('faceDetectionWorker must run inside a worker_thread')
const port = parentPort

function post(message: WorkerResponse): void {
  port.postMessage(message)
}

const YUNET_INPUT_SIZE = 640
const YUNET_STRIDES = [8, 16, 32]
// OpenCV's own FaceDetectorYN default (score_threshold=0.9) — raised from an
// earlier, more permissive 0.6 that was letting non-face regions through as
// detected "faces".
const SCORE_THRESHOLD = 0.9
const NMS_THRESHOLD = 0.3

let yunetSession: ort.InferenceSession | null = null
let sfaceSession: ort.InferenceSession | null = null
let modelsPromise: Promise<void> | null = null

// Faces are detected one photo at a time in a tight sequential loop, so
// letting each inference call spread across every CPU core (onnxruntime's
// default) repeatedly saturates the machine and starves the renderer's
// compositor thread, causing visible UI stutter during a scan — capping
// threads trades some raw scan throughput for a responsive UI.
const SESSION_OPTIONS: ort.InferenceSession.SessionOptions = {
  intraOpNumThreads: 1,
  interOpNumThreads: 1
}

function loadModels(yunetPath: string, sfacePath: string): Promise<void> {
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      ort.InferenceSession.create(yunetPath, SESSION_OPTIONS),
      ort.InferenceSession.create(sfacePath, SESSION_OPTIONS)
    ]).then(([yunet, sface]) => {
      yunetSession = yunet
      sfaceSession = sface
    })
  }
  return modelsPromise
}

// Converts an HWC RGB Uint8 buffer to the NCHW float32 tensor a model
// expects, in either RGB or BGR channel order — no normalization, matching
// OpenCV's own blobFromImage defaults for both YuNet and SFace (scalefactor
// 1, no mean subtraction).
function toNchwTensor(
  rgb: Uint8Array | Buffer,
  size: number,
  channelOrder: 'rgb' | 'bgr'
): ort.Tensor {
  const plane = size * size
  const data = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    const r = rgb[i * 3]
    const g = rgb[i * 3 + 1]
    const b = rgb[i * 3 + 2]
    if (channelOrder === 'rgb') {
      data[i] = r
      data[plane + i] = g
      data[2 * plane + i] = b
    } else {
      data[i] = b
      data[plane + i] = g
      data[2 * plane + i] = r
    }
  }
  return new ort.Tensor('float32', data, [1, 3, size, size])
}

function l2Normalize(values: Float32Array): number[] {
  let normSq = 0
  for (const v of values) normSq += v * v
  const norm = Math.sqrt(normSq) || 1
  return Array.from(values, (v) => v / norm)
}

async function readRawRgb(imagePath: string): Promise<RawImage> {
  // rotate() auto-orients via EXIF, toColourspace('srgb') avoids the same
  // libvips "colourspace: parameter space not set" crash the CLIP embedding
  // pipeline hit on grayscale/CMYK sources — see thumbnailService.ts.
  const { data, info } = await sharp(imagePath)
    .rotate()
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}

async function detectFaces(imagePath: string): Promise<DetectedFace[]> {
  if (!yunetSession || !sfaceSession) throw new Error('Face models not initialized')

  const full = await readRawRgb(imagePath)
  const { data: resizedData } = await sharp(imagePath)
    .rotate()
    .toColourspace('srgb')
    .removeAlpha()
    .resize(YUNET_INPUT_SIZE, YUNET_INPUT_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const inputTensor = toNchwTensor(resizedData, YUNET_INPUT_SIZE, 'bgr')
  const outputs = await yunetSession.run({ input: inputTensor })

  const strideOutputs: YuNetStrideOutput[] = YUNET_STRIDES.map((stride) => {
    const size = YUNET_INPUT_SIZE / stride
    return {
      stride,
      cols: size,
      rows: size,
      cls: outputs[`cls_${stride}`].data as Float32Array,
      obj: outputs[`obj_${stride}`].data as Float32Array,
      bbox: outputs[`bbox_${stride}`].data as Float32Array,
      kps: outputs[`kps_${stride}`].data as Float32Array
    }
  })

  const decoded = decodeYuNetOutputs(strideOutputs, SCORE_THRESHOLD, NMS_THRESHOLD)
  const scaleX = full.width / YUNET_INPUT_SIZE
  const scaleY = full.height / YUNET_INPUT_SIZE

  const results: DetectedFace[] = []
  for (const face of decoded) {
    const rightEye = { x: face.landmarks[0][0] * scaleX, y: face.landmarks[0][1] * scaleY }
    const leftEye = { x: face.landmarks[1][0] * scaleX, y: face.landmarks[1][1] * scaleY }

    const aligned = warpFaceCrop(full, rightEye, leftEye)
    const sfaceTensor = toNchwTensor(aligned, 112, 'rgb')
    const sfaceOutputs = await sfaceSession.run({ data: sfaceTensor })
    const embedding = l2Normalize(sfaceOutputs.fc1.data as Float32Array)

    const box: FaceBox = {
      x: (face.x * scaleX) / full.width,
      y: (face.y * scaleY) / full.height,
      w: (face.w * scaleX) / full.width,
      h: (face.h * scaleY) / full.height
    }
    results.push({ box, embedding })
  }
  return results
}

port.on('message', (message: WorkerRequest) => {
  if (message.type === 'init') {
    loadModels(message.yunetPath, message.sfacePath)
      .then(() => post({ type: 'ready' }))
      .catch((err: unknown) => {
        modelsPromise = null
        post({ type: 'initError', message: err instanceof Error ? err.message : String(err) })
      })
    return
  }

  detectFaces(message.imagePath)
    .then((faces) => post({ type: 'detectResult', requestId: message.requestId, faces }))
    .catch((err: unknown) => {
      post({
        type: 'detectError',
        requestId: message.requestId,
        message: err instanceof Error ? err.message : String(err)
      })
    })
})
