import { ExifTool, type Tags } from 'exiftool-vendored'
import { stat } from 'fs/promises'
import { basename, extname } from 'path'

import type { PhotoMetadata, PhotoRecord, RotateDirection, SupportedFormat } from '@shared/types'

let exifTool: ExifTool | null = null

function getExifTool(): ExifTool {
  if (!exifTool) {
    exifTool = new ExifTool({ maxProcs: 4 })
  }
  return exifTool
}

export async function shutdownExifTool(): Promise<void> {
  if (exifTool) {
    await exifTool.end()
    exifTool = null
  }
}

function formatFromExtension(filePath: string): SupportedFormat {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.png') return 'PNG'
  if (ext === '.tif' || ext === '.tiff') return 'TIFF'
  return 'JPEG'
}

// purely-numeric keyword can come back from exiftool as a raw JSON number — coerce to string
function toArray(value: unknown): string[] {
  if (value == null) return []
  const items = Array.isArray(value) ? value : [value]
  return items.map((item) => String(item))
}

function mergeTags(tags: Tags): string[] {
  const merged = [...toArray(tags.Keywords), ...toArray(tags.Subject)]
  return [...new Set(merged)]
}

function dateToIso(value: Tags['DateTimeOriginal'] | Tags['CreateDate']): string | null {
  if (!value) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return value.toISOString?.() ?? String(value)
}

export async function writeTags(filePath: string, tags: string[]): Promise<void> {
  const value = tags.length > 0 ? tags : null
  await getExifTool().write(
    filePath,
    { Keywords: value, Subject: value },
    { writeArgs: ['-overwrite_original'] }
  )
}

function formatExifDateTime(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const mo = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const mi = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return `${y}:${mo}:${d} ${h}:${mi}:${s}`
}

export async function writeDateTaken(filePath: string, isoDate: string): Promise<void> {
  const formatted = formatExifDateTime(new Date(isoDate))
  await getExifTool().write(
    filePath,
    { DateTimeOriginal: formatted, CreateDate: formatted },
    { writeArgs: ['-overwrite_original'] }
  )
}

// writing comment and description in sync so other tools looking at either one see the update
export async function writeComment(filePath: string, comment: string): Promise<void> {
  const value = comment.trim() === '' ? null : comment
  await getExifTool().write(
    filePath,
    { UserComment: value, Description: value },
    { writeArgs: ['-overwrite_original'] }
  )
}

// EXIF Orientation values 1-8
const ROTATE_RIGHT_MAP: Record<number, number> = { 1: 6, 6: 3, 3: 8, 8: 1, 2: 7, 7: 4, 4: 5, 5: 2 }
const ROTATE_LEFT_MAP: Record<number, number> = { 1: 8, 8: 3, 3: 6, 6: 1, 2: 5, 5: 4, 4: 7, 7: 2 }

// Lossless metadata orientation write
export async function rotatePhoto(filePath: string, direction: RotateDirection): Promise<void> {
  const tags = await getExifTool().read(filePath)
  const current = tags.Orientation ?? 1
  const map = direction === 'right' ? ROTATE_RIGHT_MAP : ROTATE_LEFT_MAP
  const next = map[current] ?? 1
  // -n is required here by exiftool
  await getExifTool().write(
    filePath,
    { Orientation: next },
    {
      writeArgs: ['-overwrite_original', '-n']
    }
  )
}

export async function readPhotoRecord(filePath: string): Promise<PhotoRecord> {
  const fileStat = await stat(filePath)
  const tags = await getExifTool().read(filePath)

  const metadata: PhotoMetadata = {
    dateTaken: dateToIso(tags.DateTimeOriginal ?? tags.CreateDate),
    cameraMake: tags.Make ?? null,
    cameraModel: tags.Model ?? null,
    widthPx: tags.ImageWidth ?? null,
    heightPx: tags.ImageHeight ?? null,
    fileSizeBytes: fileStat.size,
    format: formatFromExtension(filePath),
    comment: tags.UserComment ?? tags.Description ?? null
  }

  return {
    id: filePath,
    filePath,
    fileName: basename(filePath),
    tags: mergeTags(tags),
    metadata,
    thumbnailStatus: 'pending',
    thumbnailKey: null,
    scanError: null,
    fromCache: false,
    viewCount: 0,
    mtimeMs: fileStat.mtimeMs
  }
}
