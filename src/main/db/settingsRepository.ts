import { getDb } from './database'

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (@key, @value)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run({ key, value })
}

export function getFolders(): string[] {
  const raw = getSetting('watchedFolders')
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

export function setFolders(folders: string[]): void {
  setSetting('watchedFolders', JSON.stringify(folders))
}

export function getGalleryCellWidth(): number | null {
  const raw = getSetting('galleryCellWidth')
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

export function setGalleryCellWidth(width: number): void {
  setSetting('galleryCellWidth', String(width))
}
