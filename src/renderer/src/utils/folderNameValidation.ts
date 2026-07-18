// Conservative cross-platform block list — matches the main process's rename
// handler (settingsHandlers.ts). This copy is just for immediate UX feedback;
// the main process is the actual source of truth and validates again before
// touching the filesystem.
const INVALID_FOLDER_NAME_CHARS = /[/\\:*?"<>|]/

export function splitFolderPath(folder: string): { dirPrefix: string; base: string } {
  const idx = Math.max(folder.lastIndexOf('/'), folder.lastIndexOf('\\'))
  if (idx === -1) return { dirPrefix: '', base: folder }
  return { dirPrefix: folder.slice(0, idx + 1), base: folder.slice(idx + 1) }
}

export function validateFolderNameBase(base: string): string | null {
  if (!base.trim()) return 'Name cannot be empty'
  if (INVALID_FOLDER_NAME_CHARS.test(base)) return 'Contains invalid characters'
  return null
}
