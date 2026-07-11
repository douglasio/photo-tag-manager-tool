import { app } from 'electron'
import { createHash } from 'crypto'
import { mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'

const THUMBNAIL_LONG_EDGE = 300
const THUMBNAIL_QUALITY = 80

let thumbnailDir: string | null = null

async function getThumbnailDir(): Promise<string> {
  if (!thumbnailDir) {
    thumbnailDir = join(app.getPath('userData'), 'thumbnails')
    await mkdir(thumbnailDir, { recursive: true })
  }
  return thumbnailDir
}

export function thumbnailKeyFor(filePath: string, mtimeMs: number, sizeBytes: number): string {
  return createHash('sha1').update(`${filePath}:${mtimeMs}:${sizeBytes}`).digest('hex')
}

export async function thumbnailFilePath(thumbnailKey: string): Promise<string> {
  const dir = await getThumbnailDir()
  return join(dir, `${thumbnailKey}.jpg`)
}

export async function generateThumbnail(filePath: string, thumbnailKey: string): Promise<void> {
  const outputPath = await thumbnailFilePath(thumbnailKey)
  await sharp(filePath)
    .resize({
      width: THUMBNAIL_LONG_EDGE,
      height: THUMBNAIL_LONG_EDGE,
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .toFile(outputPath)
}

export async function deleteThumbnail(thumbnailKey: string): Promise<void> {
  const filePath = await thumbnailFilePath(thumbnailKey)
  await unlink(filePath).catch(() => undefined)
}
