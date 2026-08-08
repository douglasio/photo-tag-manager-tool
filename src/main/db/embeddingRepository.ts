import { getDb } from './database'

export function getEmbedding(filePath: string): Float32Array | null {
  const row = getDb()
    .prepare('SELECT embedding FROM photo_embeddings WHERE path = ?')
    .get(filePath) as { embedding: Buffer } | undefined
  if (!row) return null
  return new Float32Array(
    row.embedding.buffer,
    row.embedding.byteOffset,
    row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
  )
}

export function setEmbedding(filePath: string, embedding: Float32Array): void {
  const buffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength)
  getDb()
    .prepare(
      `INSERT INTO photo_embeddings (path, embedding) VALUES (@path, @embedding)
       ON CONFLICT(path) DO UPDATE SET embedding = excluded.embedding`
    )
    .run({ path: filePath, embedding: buffer })
}

/** Every cached embedding — used for duplicate detection, which needs to
 * compare a photo against the whole set rather than one tag's examples. */
export function getAllEmbeddings(): { filePath: string; embedding: Float32Array }[] {
  const rows = getDb().prepare('SELECT path, embedding FROM photo_embeddings').all() as {
    path: string
    embedding: Buffer
  }[]
  return rows.map((row) => ({
    filePath: row.path,
    embedding: new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
    )
  }))
}

export function deleteEmbedding(filePath: string): void {
  getDb().prepare('DELETE FROM photo_embeddings WHERE path = ?').run(filePath)
}

export function renameEmbedding(oldPath: string, newPath: string): void {
  getDb()
    .prepare('UPDATE photo_embeddings SET path = @newPath WHERE path = @oldPath')
    .run({ oldPath, newPath })
}
