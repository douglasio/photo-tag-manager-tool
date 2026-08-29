// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockInsertFace,
  mockFindReadyPhotosWithoutFaceScan,
  mockMarkFaceScanned,
  mockDetectFacesInImage
} = vi.hoisted(() => ({
  mockInsertFace: vi.fn(),
  mockFindReadyPhotosWithoutFaceScan: vi.fn(),
  mockMarkFaceScanned: vi.fn(),
  mockDetectFacesInImage: vi.fn()
}))

vi.mock('@main/db/faceRepository', () => ({ insertFace: mockInsertFace }))
vi.mock('@main/db/photoRepository', () => ({
  findReadyPhotosWithoutFaceScan: mockFindReadyPhotosWithoutFaceScan,
  markFaceScanned: mockMarkFaceScanned
}))
vi.mock('./faceDetectionService', () => ({ detectFacesInImage: mockDetectFacesInImage }))

import { detectAllReadyPhotoFaces } from './faceDetection'

function makePhotos(paths: string[]): { filePath: string; thumbnailKey: string }[] {
  return paths.map((filePath) => ({ filePath, thumbnailKey: `${filePath}-key` }))
}

const oneFace = [{ box: { x: 0, y: 0, w: 1, h: 1 }, embedding: [1, 0] }]

beforeEach(() => {
  vi.clearAllMocks()
  mockFindReadyPhotosWithoutFaceScan.mockReturnValue([])
  mockDetectFacesInImage.mockResolvedValue([])
})

describe('detectAllReadyPhotoFaces', () => {
  it('inserts every detected face and marks the photo scanned', async () => {
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/a.jpg']))
    mockDetectFacesInImage.mockResolvedValue(oneFace)

    const result = await detectAllReadyPhotoFaces()

    expect(result).toEqual({ photosScanned: 1, facesDetected: 1 })
    expect(mockInsertFace).toHaveBeenCalledTimes(1)
    expect(mockMarkFaceScanned).toHaveBeenCalledWith('/a.jpg')
  })

  // Regression: a faceless photo leaves no photo_faces rows, so before the
  // faceScannedAt marker it looked unscanned forever and every "Scan again"
  // re-detected the entire faceless majority of the library.
  it('marks a photo with no faces as scanned, so it leaves the queue', async () => {
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/a.jpg']))
    mockDetectFacesInImage.mockResolvedValue([])

    await detectAllReadyPhotoFaces()

    expect(mockInsertFace).not.toHaveBeenCalled()
    expect(mockMarkFaceScanned).toHaveBeenCalledWith('/a.jpg')
  })

  it('leaves a photo that threw unmarked, and keeps scanning the rest', async () => {
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg']))
    mockDetectFacesInImage.mockImplementation((filePath: string) =>
      filePath === '/a.jpg' ? Promise.reject(new Error('corrupt')) : Promise.resolve([])
    )

    const result = await detectAllReadyPhotoFaces()

    expect(mockMarkFaceScanned).not.toHaveBeenCalledWith('/a.jpg')
    expect(mockMarkFaceScanned).toHaveBeenCalledWith('/b.jpg')
    expect(result.photosScanned).toBe(2)
  })

  it('stops early once isCancelled reports true', async () => {
    mockFindReadyPhotosWithoutFaceScan.mockReturnValue(makePhotos(['/a.jpg', '/b.jpg', '/c.jpg']))
    let calls = 0
    const isCancelled = (): boolean => {
      calls++
      return calls > 1
    }

    const result = await detectAllReadyPhotoFaces(undefined, isCancelled)

    expect(mockDetectFacesInImage).toHaveBeenCalledTimes(1)
    expect(result.photosScanned).toBe(1)
  })
})
