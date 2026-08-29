// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockFindReadyPhotosWithoutFaceScan,
  mockMarkFaceScanned,
  mockGetFaceDetectionEnabled,
  mockDetectFacesInImage,
  mockInsertFace,
  mockRunFaceClustering
} = vi.hoisted(() => ({
  mockFindReadyPhotosWithoutFaceScan: vi.fn(),
  mockMarkFaceScanned: vi.fn(),
  mockGetFaceDetectionEnabled: vi.fn(),
  mockDetectFacesInImage: vi.fn(),
  mockInsertFace: vi.fn(),
  mockRunFaceClustering: vi.fn()
}))

vi.mock('@main/db/photoRepository', () => ({
  findReadyPhotosWithoutFaceScan: mockFindReadyPhotosWithoutFaceScan,
  markFaceScanned: mockMarkFaceScanned
}))
vi.mock('@main/db/faceRepository', () => ({ insertFace: mockInsertFace }))
vi.mock('@main/db/settingsRepository', () => ({
  getFaceDetectionEnabled: mockGetFaceDetectionEnabled
}))
vi.mock('./faceDetectionService', () => ({ detectFacesInImage: mockDetectFacesInImage }))
vi.mock('./faceClustering', () => ({ runFaceClustering: mockRunFaceClustering }))

// Exceeds the module's internal debounce window (3s) — tests only need
// "eventually, once idle" semantics, not the exact constant.
const PAST_DEBOUNCE_MS = 5000

function makePhotos(paths: string[]): { filePath: string; thumbnailKey: string }[] {
  return paths.map((filePath) => ({ filePath, thumbnailKey: `${filePath}-key` }))
}

const oneFace = [{ box: { x: 0, y: 0, w: 1, h: 1 }, embedding: [1, 0] }]

describe('faceIndexService', () => {
  let mod: typeof import('./faceIndexService')
  let send: ReturnType<typeof vi.fn>

  // Module-scope singleton state (running/suspended) — resetModules plus a
  // fresh dynamic import gives each test a clean instance, matching
  // embeddingIndexService.test.ts.
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    mockFindReadyPhotosWithoutFaceScan.mockReset().mockReturnValue([])
    mockMarkFaceScanned.mockReset()
    mockGetFaceDetectionEnabled.mockReset().mockReturnValue(true)
    mockDetectFacesInImage.mockReset().mockResolvedValue([])
    mockInsertFace.mockReset()
    mockRunFaceClustering.mockReset().mockResolvedValue({
      peopleCreated: 0,
      facesAssigned: 0,
      canceled: false
    })
    send = vi.fn()
    mod = await import('./faceIndexService')
    mod.setFaceIndexTarget({ send, isDestroyed: () => false } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing until the debounce window elapses', async () => {
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/a.jpg']))
    mod.kickFaceIndexer()

    await vi.advanceTimersByTimeAsync(1000)
    expect(mockDetectFacesInImage).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)
    expect(mockDetectFacesInImage).toHaveBeenCalledWith('/a.jpg')
  })

  it('does not start a pass while face detection is disabled', async () => {
    mockGetFaceDetectionEnabled.mockReturnValue(false)
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/a.jpg']))

    mod.kickFaceIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    expect(mockDetectFacesInImage).not.toHaveBeenCalled()
  })

  // The marker is what stops a faceless photo being re-detected forever, so
  // it has to be written even when detection returns nothing.
  it('marks a photo scanned even when it contains no faces', async () => {
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/a.jpg']))
    mockDetectFacesInImage.mockResolvedValue([])

    mod.kickFaceIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    expect(mockInsertFace).not.toHaveBeenCalled()
    expect(mockMarkFaceScanned).toHaveBeenCalledWith('/a.jpg')
  })

  it('leaves a photo that threw unmarked, so a later pass retries it', async () => {
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg']))
    mockDetectFacesInImage.mockImplementation((filePath: string) =>
      filePath === '/a.jpg' ? Promise.reject(new Error('corrupt')) : Promise.resolve([])
    )

    mod.kickFaceIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    expect(mockMarkFaceScanned).not.toHaveBeenCalledWith('/a.jpg')
    expect(mockMarkFaceScanned).toHaveBeenCalledWith('/b.jpg')
  })

  // Newly detected faces are unassigned until clustering groups them, so
  // without this they'd never become people in the panel.
  it('clusters after a pass that found faces, and skips clustering when it found none', async () => {
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/a.jpg']))
    mockDetectFacesInImage.mockResolvedValue(oneFace)

    mod.kickFaceIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)
    expect(mockInsertFace).toHaveBeenCalledTimes(1)
    expect(mockRunFaceClustering).toHaveBeenCalledTimes(1)

    mockRunFaceClustering.mockClear()
    mockDetectFacesInImage.mockResolvedValue([])
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/b.jpg']))
    mod.kickFaceIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    expect(mockRunFaceClustering).not.toHaveBeenCalled()
  })

  it('broadcasts progress and clears it once the pass finishes', async () => {
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg']))
    mod.kickFaceIndexer()

    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    const payloads = send.mock.calls.filter(([channel]) => channel === 'faces:indexProgress')
    expect(payloads.at(-2)?.[1]).toEqual({ done: 2, total: 2 })
    expect(payloads.at(-1)?.[1]).toBeNull()
    expect(mod.getFaceIndexStatus()).toBeNull()
  })

  it('stopFaceIndexer halts before the next photo, and resume picks back up', async () => {
    mockFindReadyPhotosWithoutFaceScan.mockReturnValueOnce(makePhotos(['/a.jpg', '/b.jpg']))
    let resolveA: (value: unknown[]) => void = () => {}
    mockDetectFacesInImage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveA = resolve
        })
    )

    mod.kickFaceIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    const stopped = mod.stopFaceIndexer()
    resolveA([])
    await stopped

    // /a.jpg's in-flight call completed; /b.jpg was never started.
    expect(mockDetectFacesInImage).toHaveBeenCalledTimes(1)
    expect(mod.getFaceIndexStatus()).toBeNull()

    mockFindReadyPhotosWithoutFaceScan.mockReturnValueOnce(makePhotos(['/b.jpg']))
    mockDetectFacesInImage.mockResolvedValue([])
    mod.resumeFaceIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    expect(mockDetectFacesInImage).toHaveBeenCalledWith('/b.jpg')
  })

  it('kickFaceIndexer no-ops while suspended', async () => {
    await mod.stopFaceIndexer()
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/a.jpg']))

    mod.kickFaceIndexer()
    await vi.advanceTimersByTimeAsync(PAST_DEBOUNCE_MS)

    expect(mockDetectFacesInImage).not.toHaveBeenCalled()
  })
})
