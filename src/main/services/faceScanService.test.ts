// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetPeople,
  mockSetFaceDetectionEnabled,
  mockRunFaceClustering,
  mockDetectAllReadyPhotoFaces,
  mockEnsureFaceModelReady,
  mockStopFaceIndexer,
  mockResumeFaceIndexer
} = vi.hoisted(() => ({
  mockGetPeople: vi.fn(),
  mockSetFaceDetectionEnabled: vi.fn(),
  mockRunFaceClustering: vi.fn(),
  mockDetectAllReadyPhotoFaces: vi.fn(),
  mockEnsureFaceModelReady: vi.fn(),
  mockStopFaceIndexer: vi.fn(),
  mockResumeFaceIndexer: vi.fn()
}))

vi.mock('@main/db/faceRepository', () => ({ getPeople: mockGetPeople }))
vi.mock('@main/db/settingsRepository', () => ({
  setFaceDetectionEnabled: mockSetFaceDetectionEnabled
}))
vi.mock('./faceClustering', () => ({ runFaceClustering: mockRunFaceClustering }))
vi.mock('./faceDetection', () => ({ detectAllReadyPhotoFaces: mockDetectAllReadyPhotoFaces }))
vi.mock('./faceDetectionService', () => ({ ensureFaceModelReady: mockEnsureFaceModelReady }))
vi.mock('./faceIndexService', () => ({
  stopFaceIndexer: mockStopFaceIndexer,
  resumeFaceIndexer: mockResumeFaceIndexer
}))

// The in-flight-scan guard is module-scope state (one shared scan app-wide),
// so each test gets a fresh module instance rather than inheriting whatever
// the previous test left in flight.
let mod: typeof import('./faceScanService')

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  mockGetPeople.mockReturnValue([])
  mockEnsureFaceModelReady.mockResolvedValue(undefined)
  mockDetectAllReadyPhotoFaces.mockResolvedValue({ photosScanned: 0, facesDetected: 0 })
  mockRunFaceClustering.mockResolvedValue({ canceled: false })
  mockStopFaceIndexer.mockResolvedValue(undefined)
  mod = await import('./faceScanService')
})

describe('runFullFaceScan', () => {
  // Both this and the background indexer drive the same detection/clustering
  // workers — overlapping them doubles the memory footprint.
  it('stops the background face indexer before starting and resumes it after', async () => {
    await mod.runFullFaceScan()

    expect(mockStopFaceIndexer.mock.invocationCallOrder[0]).toBeLessThan(
      mockEnsureFaceModelReady.mock.invocationCallOrder[0]
    )
    expect(mockResumeFaceIndexer).toHaveBeenCalled()
  })

  it('resumes the background face indexer even when the scan throws', async () => {
    mockRunFaceClustering.mockRejectedValue(new Error('worker crashed'))

    await expect(mod.runFullFaceScan()).rejects.toThrow('worker crashed')

    expect(mockResumeFaceIndexer).toHaveBeenCalled()
  })

  // Regression: a second "Scan again" while one was still running used to
  // start a whole second detection pass over the same library, driving the
  // same workers concurrently.
  it('shares the in-flight scan rather than starting a second one', async () => {
    let resolveDetect: (value: { photosScanned: number; facesDetected: number }) => void = () => {}
    mockDetectAllReadyPhotoFaces.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDetect = resolve
        })
    )

    const first = mod.runFullFaceScan()
    const second = mod.runFullFaceScan()
    // stopFaceIndexer is awaited before detection starts, so the mock hasn't
    // handed back its resolver until the microtask queue drains.
    await vi.waitFor(() => expect(mockDetectAllReadyPhotoFaces).toHaveBeenCalled())
    resolveDetect({ photosScanned: 1, facesDetected: 0 })
    const [a, b] = await Promise.all([first, second])

    expect(mockDetectAllReadyPhotoFaces).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
  })

  it('allows a fresh scan once the previous one has settled', async () => {
    await mod.runFullFaceScan()
    await mod.runFullFaceScan()

    expect(mockDetectAllReadyPhotoFaces).toHaveBeenCalledTimes(2)
  })

  it('stops before clustering once cancelFaceScan is called mid-detection', async () => {
    mockDetectAllReadyPhotoFaces.mockImplementation(
      async (_onProgress?: unknown, isCancelled?: () => boolean) => {
        mod.cancelFaceScan()
        expect(isCancelled?.()).toBe(true)
        return { photosScanned: 0, facesDetected: 0 }
      }
    )

    const result = await mod.runFullFaceScan()

    expect(result.canceled).toBe(true)
    expect(mockRunFaceClustering).not.toHaveBeenCalled()
  })
})

describe('enableFaceDetectionAndScan', () => {
  it('flips the setting on before running the shared scan', async () => {
    await mod.enableFaceDetectionAndScan()

    expect(mockSetFaceDetectionEnabled).toHaveBeenCalledWith(true)
    expect(mockDetectAllReadyPhotoFaces).toHaveBeenCalled()
  })
})
