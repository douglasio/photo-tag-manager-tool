import { ipcMain } from 'electron'
import { rename, stat } from 'fs/promises'
import { dirname, extname, join } from 'path'
import { findByPath, renamePhotoPath } from '../db/photoRepository'
import { suppressNextEvent } from '../services/watchManager'
import type { PhotoRecord } from '../../shared/types'

// Conservative cross-platform block list — covers reserved path/filesystem
// characters on both Windows and Unix rather than just the current OS, since
// a synced folder could later be opened on either.
const INVALID_FILENAME_CHARS = /[/\\:*?"<>|]/

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
}
