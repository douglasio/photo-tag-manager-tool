// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRead, mockWrite, mockStat } = vi.hoisted(() => ({
  mockRead: vi.fn(),
  mockWrite: vi.fn(),
  mockStat: vi.fn()
}))

vi.mock('exiftool-vendored', () => {
  class MockExifTool {
    read = mockRead
    write = mockWrite
    end = vi.fn()
  }
  return { ExifTool: MockExifTool }
})

vi.mock('fs/promises', () => ({ stat: mockStat, default: { stat: mockStat } }))
vi.mock('node:fs/promises', () => ({ stat: mockStat, default: { stat: mockStat } }))

import {
  readPhotoRecord,
  rotatePhoto,
  writeComment,
  writeDateTaken,
  writeTags
} from './metadataService'

describe('metadataService', () => {
  beforeEach(() => {
    mockRead.mockReset()
    mockWrite.mockReset()
    mockStat.mockReset()
  })

  describe('writeTags', () => {
    it('writes both Keywords and Subject', async () => {
      await writeTags('/a.jpg', ['vacation', 'beach'])
      expect(mockWrite).toHaveBeenCalledWith(
        '/a.jpg',
        { Keywords: ['vacation', 'beach'], Subject: ['vacation', 'beach'] },
        { writeArgs: ['-overwrite_original'] }
      )
    })

    it('clears both fields with null when given an empty list', async () => {
      await writeTags('/a.jpg', [])
      expect(mockWrite).toHaveBeenCalledWith(
        '/a.jpg',
        { Keywords: null, Subject: null },
        { writeArgs: ['-overwrite_original'] }
      )
    })
  })

  describe('writeDateTaken', () => {
    it('formats the ISO date into EXIF datetime format and writes both fields', async () => {
      await writeDateTaken('/a.jpg', '2024-03-05T14:30:05')
      expect(mockWrite).toHaveBeenCalledWith(
        '/a.jpg',
        { DateTimeOriginal: '2024:03:05 14:30:05', CreateDate: '2024:03:05 14:30:05' },
        { writeArgs: ['-overwrite_original'] }
      )
    })
  })

  describe('writeComment', () => {
    it('writes UserComment and Description', async () => {
      await writeComment('/a.jpg', 'Nice sunset')
      expect(mockWrite).toHaveBeenCalledWith(
        '/a.jpg',
        { UserComment: 'Nice sunset', Description: 'Nice sunset' },
        { writeArgs: ['-overwrite_original'] }
      )
    })

    it('clears the fields for a blank/whitespace comment', async () => {
      await writeComment('/a.jpg', '   ')
      expect(mockWrite).toHaveBeenCalledWith(
        '/a.jpg',
        { UserComment: null, Description: null },
        { writeArgs: ['-overwrite_original'] }
      )
    })
  })

  describe('rotatePhoto', () => {
    it('rotates right through the orientation map and passes -n', async () => {
      mockRead.mockResolvedValue({ Orientation: 1 })
      await rotatePhoto('/a.jpg', 'right')
      expect(mockWrite).toHaveBeenCalledWith(
        '/a.jpg',
        { Orientation: 6 },
        { writeArgs: ['-overwrite_original', '-n'] }
      )
    })

    it('rotates left through the orientation map', async () => {
      mockRead.mockResolvedValue({ Orientation: 6 })
      await rotatePhoto('/a.jpg', 'left')
      expect(mockWrite).toHaveBeenCalledWith(
        '/a.jpg',
        { Orientation: 1 },
        { writeArgs: ['-overwrite_original', '-n'] }
      )
    })

    it('rotates mirrored orientations in place rather than un-mirroring them', async () => {
      mockRead.mockResolvedValue({ Orientation: 2 })
      await rotatePhoto('/a.jpg', 'right')
      expect(mockWrite).toHaveBeenCalledWith(
        '/a.jpg',
        { Orientation: 7 },
        { writeArgs: ['-overwrite_original', '-n'] }
      )
    })

    it('defaults to orientation 1 when the file has none set', async () => {
      mockRead.mockResolvedValue({})
      await rotatePhoto('/a.jpg', 'right')
      expect(mockWrite).toHaveBeenCalledWith(
        '/a.jpg',
        { Orientation: 6 },
        { writeArgs: ['-overwrite_original', '-n'] }
      )
    })
  })

  describe('readPhotoRecord', () => {
    it('builds a PhotoRecord from file stats and tags', async () => {
      mockStat.mockResolvedValue({ size: 12345 } as never)
      mockRead.mockResolvedValue({
        DateTimeOriginal: '2024:03:05 14:30:00',
        Make: 'Canon',
        Model: 'EOS R5',
        ImageWidth: 4000,
        ImageHeight: 3000,
        Keywords: ['a', 'b'],
        Subject: ['b', 'c'],
        UserComment: 'hello'
      })

      const record = await readPhotoRecord('/root/a.jpg')

      expect(record.filePath).toBe('/root/a.jpg')
      expect(record.fileName).toBe('a.jpg')
      expect(record.tags.sort()).toEqual(['a', 'b', 'c'])
      expect(record.metadata.cameraMake).toBe('Canon')
      expect(record.metadata.widthPx).toBe(4000)
      expect(record.metadata.fileSizeBytes).toBe(12345)
      expect(record.metadata.format).toBe('JPEG')
      expect(record.metadata.comment).toBe('hello')
      expect(record.thumbnailStatus).toBe('pending')
    })

    it('derives format from the file extension', async () => {
      mockStat.mockResolvedValue({ size: 1 } as never)
      mockRead.mockResolvedValue({})
      const png = await readPhotoRecord('/root/a.png')
      expect(png.metadata.format).toBe('PNG')
      const tiff = await readPhotoRecord('/root/a.tiff')
      expect(tiff.metadata.format).toBe('TIFF')
    })

    it('falls back from UserComment to Description', async () => {
      mockStat.mockResolvedValue({ size: 1 } as never)
      mockRead.mockResolvedValue({ Description: 'fallback comment' })
      const record = await readPhotoRecord('/root/a.jpg')
      expect(record.metadata.comment).toBe('fallback comment')
    })

    it('deduplicates tags merged from Keywords and Subject', async () => {
      mockStat.mockResolvedValue({ size: 1 } as never)
      mockRead.mockResolvedValue({ Keywords: 'solo', Subject: 'solo' })
      const record = await readPhotoRecord('/root/a.jpg')
      expect(record.tags).toEqual(['solo'])
    })

    it('coerces a purely-numeric keyword to a string instead of leaving it a number', async () => {
      // exiftool-vendored types Keywords/Subject as string | string[], but a
      // keyword that's just digits (e.g. "2024") can come back from exiftool
      // itself as a raw JSON number — a non-string tag crashes TagsInput
      // downstream, far from any context explaining why.
      mockStat.mockResolvedValue({ size: 1 } as never)
      mockRead.mockResolvedValue({ Keywords: [2024, 'vacation'] as unknown as string[] })
      const record = await readPhotoRecord('/root/a.jpg')
      expect(record.tags.sort()).toEqual(['2024', 'vacation'])
      expect(record.tags.every((tag) => typeof tag === 'string')).toBe(true)
    })
  })
})
