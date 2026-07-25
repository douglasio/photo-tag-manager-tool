// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PhotoRecord } from '../../shared/types'

const {
  mockStat,
  mockReadPhotoRecord,
  mockGenerateThumbnail,
  mockThumbnailKeyFor,
  mockFindByPath,
  mockUpsertPhoto,
  mockUpdateThumbnail
} = vi.hoisted(() => ({
  mockStat: vi.fn(),
  mockReadPhotoRecord: vi.fn(),
  mockGenerateThumbnail: vi.fn(),
  mockThumbnailKeyFor: vi.fn().mockReturnValue('thekey'),
  mockFindByPath: vi.fn(),
  mockUpsertPhoto: vi.fn(),
  mockUpdateThumbnail: vi.fn()
}))

vi.mock('fs/promises', () => ({ stat: mockStat, default: { stat: mockStat } }))
vi.mock('./metadataService', () => ({ readPhotoRecord: mockReadPhotoRecord }))
vi.mock('./thumbnailService', () => ({
  generateThumbnail: mockGenerateThumbnail,
  thumbnailKeyFor: mockThumbnailKeyFor
}))
vi.mock('../db/photoRepository', () => ({
  findByPath: mockFindByPath,
  upsertPhoto: mockUpsertPhoto,
  updateThumbnail: mockUpdateThumbnail
}))

import { ingestFile } from './photoIngest'

function makePhoto(filePath: string, overrides: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: filePath,
    filePath,
    fileName: filePath.split('/').pop() ?? filePath,
    tags: [],
    metadata: {
      dateTaken: null,
      cameraMake: null,
      cameraModel: null,
      widthPx: null,
      heightPx: null,
      fileSizeBytes: 0,
      format: 'JPEG',
      comment: null
    },
    thumbnailStatus: 'pending',
    thumbnailKey: null,
    scanError: null,
    fromCache: false,
    ...overrides
  }
}

// Runs one task at a time, synchronously in submission order — matches the
// real p-limit semantics closely enough for these tests' purposes.
const noLimit = async <T>(fn: () => Promise<T>): Promise<T> => fn()

describe('ingestFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockThumbnailKeyFor.mockReturnValue('thekey')
  })

  it('reuses the cached record when mtime and size are unchanged, but still generates a missing thumbnail', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 100, size: 200 })
    mockFindByPath.mockReturnValue({
      record: makePhoto('/a.jpg', { thumbnailStatus: 'pending' }),
      mtimeMs: 100,
      sizeBytes: 200
    })
    mockGenerateThumbnail.mockResolvedValue(undefined)

    const { photo, fromCache } = await ingestFile('/a.jpg', noLimit)

    expect(fromCache).toBe(true)
    expect(mockReadPhotoRecord).not.toHaveBeenCalled()
    expect(mockGenerateThumbnail).toHaveBeenCalledWith('/a.jpg', 'thekey')
    expect(photo.thumbnailStatus).toBe('ready')
    expect(photo.thumbnailKey).toBe('thekey')
  })

  it('re-reads metadata when the cache is stale (mtime differs)', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 999, size: 200 })
    mockFindByPath.mockReturnValue({
      record: makePhoto('/a.jpg'),
      mtimeMs: 100,
      sizeBytes: 200
    })
    mockReadPhotoRecord.mockResolvedValue(makePhoto('/a.jpg', { thumbnailStatus: 'ready' }))

    const { fromCache } = await ingestFile('/a.jpg', noLimit)

    expect(fromCache).toBe(false)
    expect(mockReadPhotoRecord).toHaveBeenCalledWith('/a.jpg')
    expect(mockUpsertPhoto).toHaveBeenCalledWith(expect.any(Object), 999, 200)
  })

  it('re-reads metadata when there is no cache entry at all', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 1, size: 2 })
    mockFindByPath.mockReturnValue(undefined)
    mockReadPhotoRecord.mockResolvedValue(makePhoto('/a.jpg', { thumbnailStatus: 'ready' }))

    const { fromCache } = await ingestFile('/a.jpg', noLimit)
    expect(fromCache).toBe(false)
  })

  it('skips thumbnail generation when the photo already has one ready', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 100, size: 200 })
    mockFindByPath.mockReturnValue({
      record: makePhoto('/a.jpg', { thumbnailStatus: 'ready', thumbnailKey: 'existing' }),
      mtimeMs: 100,
      sizeBytes: 200
    })

    const { photo } = await ingestFile('/a.jpg', noLimit)
    expect(mockGenerateThumbnail).not.toHaveBeenCalled()
    expect(photo.thumbnailKey).toBe('existing')
  })

  it('marks the thumbnail as errored when generation throws', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 100, size: 200 })
    mockFindByPath.mockReturnValue({
      record: makePhoto('/a.jpg', { thumbnailStatus: 'pending' }),
      mtimeMs: 100,
      sizeBytes: 200
    })
    mockGenerateThumbnail.mockRejectedValue(new Error('sharp failed'))

    const { photo } = await ingestFile('/a.jpg', noLimit)

    expect(mockUpdateThumbnail).toHaveBeenCalledWith('/a.jpg', 'thekey', 'error')
    expect(photo.thumbnailStatus).toBe('error')
    expect(photo.thumbnailKey).toBeNull()
  })
})
