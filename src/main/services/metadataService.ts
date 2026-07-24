import { ExifTool, type Tags } from 'exiftool-vendored'
import { stat } from 'fs/promises'
import { basename, extname } from 'path'
import type { PhotoMetadata, PhotoRecord, SupportedFormat } from '../../shared/types'

let exifTool: ExifTool | null = null

export function getExifTool(): ExifTool {
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

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
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
  // Keywords (IPTC) and Subject (XMP) are the two fields mergeTags() reads back;
  // writing both keeps other tools (Lightroom, Photos, etc.) in sync too. A `null`
  // value clears the tag entirely, which a plain empty array won't do.
  const value = tags.length > 0 ? tags : null
  await getExifTool().write(
    filePath,
    { Keywords: value, Subject: value },
    { writeArgs: ['-overwrite_original'] }
  )
}

// EXIF date/time tags (DateTimeOriginal, CreateDate) are conventionally
// naive local time with no timezone attached — formatting via the Date
// object's local getters (rather than toISOString, which would shift to
// UTC) is what keeps this a lossless round-trip with dateToIso's reverse
// conversion above, since both run on the same machine/timezone.
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

// UserComment (EXIF) and Description (IPTC/XMP) are the two fields
// readPhotoRecord falls back across when reading — writing both keeps them
// in sync so other tools looking at either one see the update.
export async function writeComment(filePath: string, comment: string): Promise<void> {
  const value = comment.trim() === '' ? null : comment
  await getExifTool().write(
    filePath,
    { UserComment: value, Description: value },
    { writeArgs: ['-overwrite_original'] }
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
    fromCache: false
  }
}
