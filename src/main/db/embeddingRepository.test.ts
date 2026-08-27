// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetDb, mockGetExcludedFolders } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockGetExcludedFolders: vi.fn()
}))
vi.mock('./database', () => ({ getDb: mockGetDb }))
vi.mock('./settingsRepository', () => ({ getExcludedFolders: mockGetExcludedFolders }))

import {
  deleteEmbedding,
  getAllEmbeddings,
  renameEmbedding,
  setEmbedding
} from './embeddingRepository'

// Mimics just enough of better-sqlite3's prepare().all()/.get()/.run() to
// exercise embeddingRepository's SQL shapes against a real in-memory Map,
// tracking how often the full-table SELECT actually runs so the read cache
// can be asserted on.
function createFakeDb(): { store: Map<string, Buffer>; allReads: () => number } {
  const store = new Map<string, Buffer>()
  let allReadCount = 0
  const db = {
    prepare: (sql: string) => {
      const trimmed = sql.trim()
      if (trimmed.startsWith('SELECT path, embedding')) {
        return {
          all: () => {
            allReadCount++
            return Array.from(store, ([path, embedding]) => ({ path, embedding }))
          }
        }
      }
      if (trimmed.startsWith('SELECT embedding')) {
        return {
          get: (path: string) => (store.has(path) ? { embedding: store.get(path) } : undefined)
        }
      }
      if (trimmed.startsWith('INSERT')) {
        return {
          run: ({ path, embedding }: { path: string; embedding: Buffer }) => {
            store.set(path, embedding)
          }
        }
      }
      if (trimmed.startsWith('DELETE')) {
        return { run: (path: string) => store.delete(path) }
      }
      // UPDATE ... SET path = @newPath WHERE path = @oldPath
      return {
        run: ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
          const embedding = store.get(oldPath)
          if (embedding) {
            store.delete(oldPath)
            store.set(newPath, embedding)
          }
        }
      }
    }
  }
  mockGetDb.mockReturnValue(db)
  return { store, allReads: () => allReadCount }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetExcludedFolders.mockReturnValue([])
})

describe('getAllEmbeddings caching', () => {
  it('reads the table once and serves repeat calls from the cache', () => {
    const { allReads } = createFakeDb()
    setEmbedding('/a.jpg', Float32Array.from([1, 0]))

    const first = getAllEmbeddings()
    const second = getAllEmbeddings()

    expect(first.map((row) => row.filePath)).toEqual(['/a.jpg'])
    expect(second).toBe(first)
    expect(allReads()).toBe(1)
  })

  it('invalidates on setEmbedding, deleteEmbedding, and renameEmbedding', () => {
    createFakeDb()
    setEmbedding('/a.jpg', Float32Array.from([1, 0]))
    expect(getAllEmbeddings().map((row) => row.filePath)).toEqual(['/a.jpg'])

    setEmbedding('/b.jpg', Float32Array.from([0, 1]))
    expect(
      getAllEmbeddings()
        .map((row) => row.filePath)
        .sort()
    ).toEqual(['/a.jpg', '/b.jpg'])

    renameEmbedding('/a.jpg', '/c.jpg')
    expect(
      getAllEmbeddings()
        .map((row) => row.filePath)
        .sort()
    ).toEqual(['/b.jpg', '/c.jpg'])

    deleteEmbedding('/b.jpg')
    expect(getAllEmbeddings().map((row) => row.filePath)).toEqual(['/c.jpg'])
  })

  it('rebuilds when getDb returns a different instance (library import/clear reopens the DB)', () => {
    const first = createFakeDb()
    setEmbedding('/old.jpg', Float32Array.from([1]))
    expect(getAllEmbeddings().map((row) => row.filePath)).toEqual(['/old.jpg'])
    expect(first.allReads()).toBe(1)

    // A closeDb()/reopen hands back a brand-new Database instance whose
    // contents may be completely different — the cache must not survive it.
    const second = createFakeDb()
    setEmbedding('/new.jpg', Float32Array.from([2]))
    expect(getAllEmbeddings().map((row) => row.filePath)).toEqual(['/new.jpg'])
    expect(second.allReads()).toBe(1)
  })

  it('applies the excluded-folders filter per call, on top of the cached rows', () => {
    const { allReads } = createFakeDb()
    setEmbedding('/keep/a.jpg', Float32Array.from([1]))
    setEmbedding('/hidden/b.jpg', Float32Array.from([2]))

    expect(getAllEmbeddings()).toHaveLength(2)

    mockGetExcludedFolders.mockReturnValue(['/hidden'])
    expect(getAllEmbeddings().map((row) => row.filePath)).toEqual(['/keep/a.jpg'])
    // The settings change alone must not force a table re-read.
    expect(allReads()).toBe(1)
  })
})
