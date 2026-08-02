import { ipcMain } from 'electron'
import { copyFile, rename, stat, unlink } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'

import { findByPath, incrementViewCount, renamePhotoPath } from '@main/db/photoRepository'
import { rotatePhoto, writeComment, writeDateTaken } from '@main/services/metadataService'
import { ingestFile } from '@main/services/photoIngest'
import { suppressNextEvent } from '@main/services/watchManager'
import type { MoveProgressEvent, PhotoRecord, RotateDirection } from '@shared/types'

// Covers reserved path characters on both Windows and Unix, since a synced folder could later be opened on either.
const INVALID_FILENAME_CHARS = /[/\\:*?"<>|]/

const MAX_COLLISION_ATTEMPTS = 1000

// Appends " (n)" before the extension if a same-named file already exists at the destination.
async function resolveDestPath(filePath: string, destFolder: string): Promise<string> {
  const ext = extname(filePath)
  const base = basename(filePath, ext)
  for (let attempt = 0; attempt < MAX_COLLISION_ATTEMPTS; attempt++) {
    const candidateName = attempt === 0 ? `${base}${ext}` : `${base} (${attempt})${ext}`
    const destPath = join(destFolder, candidateName)
    if (!(await stat(destPath).catch(() => null))) return destPath
  }
  throw new Error(`Could not find a free filename for ${base}${ext} in ${destFolder}`)
}

// fs.rename fails with EXDEV across filesystems/volumes — falls back to copy-then-delete-original in that case.
async function moveIntoFolder(filePath: string, destFolder: string): Promise<string> {
  const destPath = await resolveDestPath(filePath, destFolder)
  suppressNextEvent(filePath)
  suppressNextEvent(destPath)
  try {
    await rename(filePath, destPath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err
    await copyFile(filePath, destPath)
    await unlink(filePath)
  }
  return destPath
}

export function registerPhotoHandlers(): void {
  ipcMain.handle(
    'photo:rename',
    async (_event, filePath: string, newBaseName: string): Promise<PhotoRecord> => {
      const trimmed = newBaseName.trim()
      if (!trimmed) throw new Error('File name cannot be empty')
      if (INVALID_FILENAME_CHARS.test(trimmed)) {
        throw new Error('File name contains invalid characters')
      }

      const cached = findByPath(filePath)
      if (!cached) throw new Error('Photo not found')

      const extension = extname(filePath)
      const fileName = `${trimmed}${extension}`
      const newPath = join(dirname(filePath), fileName)

      if (newPath === filePath) return cached.record

      const alreadyExists = await stat(newPath).catch(() => null)
      if (alreadyExists) throw new Error('A file with that name already exists')

      suppressNextEvent(filePath)
      suppressNextEvent(newPath)
      await rename(filePath, newPath)
      renamePhotoPath(filePath, newPath, fileName)

      return { ...cached.record, id: newPath, filePath: newPath, fileName }
    }
  )

  ipcMain.handle(
    'photo:updateDateTaken',
    async (_event, filePath: string, isoDate: string): Promise<PhotoRecord> => {
      suppressNextEvent(filePath)
      await writeDateTaken(filePath, isoDate)
      const { photo } = await ingestFile(filePath, (fn) => fn(), { pixelsUnchanged: true })
      return photo
    }
  )

  ipcMain.handle(
    'photo:updateComment',
    async (_event, filePath: string, comment: string): Promise<PhotoRecord> => {
      suppressNextEvent(filePath)
      await writeComment(filePath, comment)
      const { photo } = await ingestFile(filePath, (fn) => fn(), { pixelsUnchanged: true })
      return photo
    }
  )

  ipcMain.handle(
    'photo:rotate',
    async (_event, filePath: string, direction: RotateDirection): Promise<PhotoRecord> => {
      suppressNextEvent(filePath)
      await rotatePhoto(filePath, direction)
      const { photo } = await ingestFile(filePath, (fn) => fn())
      return photo
    }
  )

  // DB-only app state — no file write/watcher involved. Returns null (not throwing) since callers fire this passively.
  ipcMain.handle('photo:incrementView', (_event, filePath: string): PhotoRecord | null => {
    incrementViewCount(filePath)
    return findByPath(filePath)?.record ?? null
  })

  ipcMain.handle(
    'photo:moveToFolder',
    async (
      event,
      filePaths: string[],
      destFolder: string
    ): Promise<{ moved: { oldPath: string; photo: PhotoRecord }[]; skipped: number }> => {
      const moved: { oldPath: string; photo: PhotoRecord }[] = []
      let skipped = 0
      // Sequential rather than Promise.all — keeps collision-suffix numbering (" (1)", " (2)", ...) stable across the same destFolder.
      for (const filePath of filePaths) {
        // Dropping a photo onto its current folder is a no-op.
        if (dirname(filePath) === destFolder) {
          skipped++
        } else {
          const cached = findByPath(filePath)
          if (!cached) {
            skipped++
          } else {
            const newPath = await moveIntoFolder(filePath, destFolder)
            const fileName = basename(newPath)
            renamePhotoPath(filePath, newPath, fileName)
            moved.push({
              oldPath: filePath,
              photo: { ...cached.record, id: newPath, filePath: newPath, fileName }
            })
          }
        }
        const progress: MoveProgressEvent = {
          completed: moved.length + skipped,
          total: filePaths.length
        }
        event.sender.send('photo:moveProgress', progress)
      }
      return { moved, skipped }
    }
  )
}
