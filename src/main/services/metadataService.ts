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
