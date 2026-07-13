// Conservative cross-platform block list — matches the main process's rename
// handler (photoHandlers.ts). This copy is just for immediate UX feedback;
// the main process is the actual source of truth and validates again before
// touching the filesystem.
const INVALID_FILENAME_CHARS = /[/\\:*?"<>|]/

export function splitFileName(fileName: string): { base: string; extension: string } {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return { base: fileName, extension: '' }
  return { base: fileName.slice(0, dot), extension: fileName.slice(dot) }
}

export function validateFileNameBase(base: string): string | null {
  if (!base.trim()) return 'Name cannot be empty'
  if (INVALID_FILENAME_CHARS.test(base)) return 'Contains invalid characters'
  return null
}
