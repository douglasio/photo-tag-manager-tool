import { ipcMain } from 'electron'
import { copyFile, rename, stat, unlink } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import { findByPath, renamePhotoPath } from '../db/photoRepository'
import { suppressNextEvent } from '../services/watchManager'
import type { MoveProgressEvent, PhotoRecord } from '../../shared/types'

// Conservative cross-platform block list — covers reserved path/filesystem
// characters on both Windows and Unix rather than just the current OS, since
// a synced folder could later be opened on either.
const INVALID_FILENAME_CHARS = /[/\\:*?"<>|]/

const MAX_COLLISION_ATTEMPTS = 1000

// Picks a destination path for filePath inside destFolder, appending " (n)"
// before the extension if a same-named file is already there. This check is
// inherently racy (stat-then-use, not atomic) — acceptable here since moves
// run sequentially against the same destFolder within one call, matching the
// same non-atomic collision check photo:rename already relies on.
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

// Moves filePath into destFolder, returning its new path. fs.rename is
// atomic and the common case, but fails with EXDEV when source and
// destination are on different filesystems/volumes — falls back to
// copy-then-delete-original in that case.
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
    'photo:moveToFolder',
    async (
      event,
      filePaths: string[],
      destFolder: string
    ): Promise<{ moved: { oldPath: string; photo: PhotoRecord }[]; skipped: number }> => {
      const moved: { oldPath: string; photo: PhotoRecord }[] = []
      let skipped = 0
      // Sequential rather than Promise.all — these are ordinary user-visible
      // file moves (not a batch-import hot path), and running them one at a
      // time keeps collision-suffix numbering (" (1)", " (2)", ...) stable
      // and easy to reason about rather than racing on the same destFolder.
      for (const filePath of filePaths) {
        // Dropping a photo onto the folder it's already in is a no-op — skip
        // it rather than "moving" it to the same place.
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
