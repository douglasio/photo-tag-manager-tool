import { getDb } from './database'

export function getDismissedDuplicateSignatures(): Set<string> {
  const rows = getDb().prepare('SELECT signature FROM dismissed_duplicate_groups').all() as {
    signature: string
  }[]
  return new Set(rows.map((row) => row.signature))
}

export function dismissDuplicateGroup(signature: string): void {
  getDb()
    .prepare(
      `INSERT INTO dismissed_duplicate_groups (signature, dismissedAt) VALUES (@signature, @dismissedAt)
       ON CONFLICT(signature) DO NOTHING`
    )
    .run({ signature, dismissedAt: Date.now() })
}
