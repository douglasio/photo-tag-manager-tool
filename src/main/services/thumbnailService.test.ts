// @vitest-environment node
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetPath, mockMkdir, mockUnlink, mockToFile, mockSharp } = vi.hoisted(() => {
  const mockToFile = vi.fn().mockResolvedValue(undefined)
  const chain = {
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toFile: mockToFile
  }
  return {
    mockGetPath: vi.fn().mockReturnValue('/tmp/userData'),
    mockMkdir: vi.fn().mockResolvedValue(undefined),
    mockUnlink: vi.fn().mockResolvedValue(undefined),
    mockToFile,
    mockSharp: vi.fn().mockReturnValue(chain)
  }
})

vi.mock('electron', () => ({ app: { getPath: mockGetPath } }))
vi.mock('fs/promises', () => ({
  mkdir: mockMkdir,
  unlink: mockUnlink,
  default: { mkdir: mockMkdir, unlink: mockUnlink }
}))
vi.mock('sharp', () => ({ default: mockSharp }))

import {
  deleteThumbnail,
  generateThumbnail,
  thumbnailFilePath,
  thumbnailKeyFor
} from './thumbnailService'

describe('thumbnailService', () => {
  beforeEach(() => {
    mockMkdir.mockClear()
    mockUnlink.mockClear()
    mockSharp.mockClear()
    mockToFile.mockClear()
  })

  describe('thumbnailKeyFor', () => {
    it('is deterministic for the same inputs', () => {
      const a = thumbnailKeyFor('/a.jpg', 123, 456)
      const b = thumbnailKeyFor('/a.jpg', 123, 456)
      expect(a).toBe(b)
    })

    it('differs when any input changes', () => {
      const base = thumbnailKeyFor('/a.jpg', 123, 456)
      expect(thumbnailKeyFor('/b.jpg', 123, 456)).not.toBe(base)
      expect(thumbnailKeyFor('/a.jpg', 999, 456)).not.toBe(base)
      expect(thumbnailKeyFor('/a.jpg', 123, 999)).not.toBe(base)
    })
  })

  describe('thumbnailFilePath', () => {
    it('builds a .jpg path under the userData thumbnails directory, creating it once', async () => {
      const first = await thumbnailFilePath('abc123')
      expect(first).toBe(join('/tmp/userData', 'thumbnails', 'abc123.jpg'))
      expect(mockMkdir).toHaveBeenCalledWith(join('/tmp/userData', 'thumbnails'), {
        recursive: true
      })

      await thumbnailFilePath('key2')
      // thumbnailDir is cached at module scope after the first call, so a
      // second call (for any key) must not re-create the directory.
      expect(mockMkdir).toHaveBeenCalledTimes(1)
    })
  })

  describe('generateThumbnail', () => {
    it('auto-rotates, resizes, and writes a jpeg to the thumbnail path', async () => {
      await generateThumbnail('/source.jpg', 'thekey')
      expect(mockSharp).toHaveBeenCalledWith('/source.jpg')
      expect(mockToFile).toHaveBeenCalledWith(join('/tmp/userData', 'thumbnails', 'thekey.jpg'))
    })
  })

  describe('deleteThumbnail', () => {
    it('unlinks the thumbnail file', async () => {
      await deleteThumbnail('thekey')
      expect(mockUnlink).toHaveBeenCalledWith(join('/tmp/userData', 'thumbnails', 'thekey.jpg'))
    })

    it('swallows an unlink failure (e.g. already-deleted file)', async () => {
      mockUnlink.mockRejectedValueOnce(new Error('ENOENT'))
      await expect(deleteThumbnail('thekey')).resolves.toBeUndefined()
    })
  })
})
