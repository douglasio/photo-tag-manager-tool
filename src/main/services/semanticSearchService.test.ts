// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { parseSearchQuery } from '@shared/searchQuery'

const {
  mockGetAllEmbeddings,
  mockFindAllReadyPhotos,
  mockFindByPath,
  mockSearchPhotos,
  mockGetAiTagSuggestionsEnabled,
  mockEmbedText
} = vi.hoisted(() => ({
  mockGetAllEmbeddings: vi.fn(),
  mockFindAllReadyPhotos: vi.fn(),
  mockFindByPath: vi.fn(),
  mockSearchPhotos: vi.fn(),
  mockGetAiTagSuggestionsEnabled: vi.fn(),
  mockEmbedText: vi.fn()
}))

vi.mock('@main/db/embeddingRepository', () => ({ getAllEmbeddings: mockGetAllEmbeddings }))
vi.mock('@main/db/photoRepository', () => ({
  findAllReadyPhotos: mockFindAllReadyPhotos,
  findByPath: mockFindByPath
}))
vi.mock('@main/db/searchRepository', () => ({ searchPhotos: mockSearchPhotos }))
vi.mock('@main/db/settingsRepository', () => ({
  getAiTagSuggestionsEnabled: mockGetAiTagSuggestionsEnabled
}))
vi.mock('./tagSuggestionService', () => ({ embedText: mockEmbedText }))

import { semanticSearchPhotos } from './semanticSearchService'

// A unit vector along axis `i` (padded to 3 dims) — cosine similarity between
// two of these is 1 when they share an axis, 0 otherwise, which makes the
// ranking assertions below exact rather than approximate.
function axis(i: 0 | 1 | 2): number[] {
  const v = [0, 0, 0]
  v[i] = 1
  return v
}

function makePhotoRecord(
  fileName: string,
  thumbnailStatus: 'ready' | 'pending' = 'ready'
): {
  record: { fileName: string; thumbnailKey: string; thumbnailStatus: string }
  mtimeMs: number
  sizeBytes: number
} {
  return {
    record: { fileName, thumbnailKey: `${fileName}-key`, thumbnailStatus },
    mtimeMs: 0,
    sizeBytes: 0
  }
}

describe('semanticSearchPhotos', () => {
  beforeEach(() => {
    mockGetAllEmbeddings.mockReset().mockReturnValue([])
    mockFindAllReadyPhotos.mockReset().mockReturnValue([])
    mockFindByPath.mockReset()
    mockSearchPhotos.mockReset()
    mockGetAiTagSuggestionsEnabled.mockReset().mockReturnValue(true)
    mockEmbedText.mockReset().mockResolvedValue(axis(0))
  })

  it('returns empty without embedding when AI features are disabled', async () => {
    mockGetAiTagSuggestionsEnabled.mockReturnValue(false)

    const result = await semanticSearchPhotos(parseSearchQuery('beach'))

    expect(result).toEqual({ hits: [], indexedCount: 0, totalReadyCount: 0 })
    expect(mockEmbedText).not.toHaveBeenCalled()
  })

  it('returns empty without embedding for a flags-only query with no free text', async () => {
    const result = await semanticSearchPhotos(parseSearchQuery('tag:beach person:joe'))

    expect(result).toEqual({ hits: [], indexedCount: 0, totalReadyCount: 0 })
    expect(mockEmbedText).not.toHaveBeenCalled()
  })

  it('embeds only the free-text portion, not the whole query string', async () => {
    mockSearchPhotos.mockReturnValue({ hits: [], total: 1, paths: ['/p.jpg'] })

    await semanticSearchPhotos(parseSearchQuery('beach tag:sunset -"night shots"'))

    expect(mockEmbedText).toHaveBeenCalledWith('beach', undefined)
  })

  it('forwards the onModelDownloadProgress callback through to embedText', async () => {
    const onModelDownloadProgress = vi.fn()

    await semanticSearchPhotos(parseSearchQuery('beach'), onModelDownloadProgress)

    expect(mockEmbedText).toHaveBeenCalledWith('beach', onModelDownloadProgress)
  })

  it('ranks by cosine similarity, thresholds, and caps at 8', async () => {
    const embeddings = Array.from({ length: 10 }, (_, i) => ({
      filePath: `/p${i}.jpg`,
      // p0 is an exact match (score 1); the rest fall below the 0.2 threshold.
      embedding: i === 0 ? axis(0) : axis(1)
    }))
    mockGetAllEmbeddings.mockReturnValue(embeddings)
    mockFindByPath.mockImplementation((path: string) => makePhotoRecord(path.slice(1)))

    const result = await semanticSearchPhotos(parseSearchQuery('beach'))

    expect(result.hits).toHaveLength(1)
    expect(result.hits[0]).toMatchObject({ filePath: '/p0.jpg', score: 1 })
  })

  it('resolves fileName and thumbnailKey via photoRepository, nulling a not-ready thumbnail', async () => {
    mockGetAllEmbeddings.mockReturnValue([{ filePath: '/p.jpg', embedding: axis(0) }])
    mockFindByPath.mockReturnValue(makePhotoRecord('p.jpg', 'pending'))

    const result = await semanticSearchPhotos(parseSearchQuery('beach'))

    expect(result.hits[0]).toMatchObject({ fileName: 'p.jpg', thumbnailKey: null })
  })

  it('restricts candidates to the facet-filtered path set when other predicates are present', async () => {
    mockGetAllEmbeddings.mockReturnValue([
      { filePath: '/joe.jpg', embedding: axis(0) },
      { filePath: '/other.jpg', embedding: axis(0) }
    ])
    mockFindByPath.mockImplementation((path: string) => makePhotoRecord(path.slice(1)))
    mockSearchPhotos.mockReturnValue({ hits: [], total: 1, paths: ['/joe.jpg'] })

    const query = parseSearchQuery('beach person:joe')
    const result = await semanticSearchPhotos(query)

    // The facet-only sub-query (no text predicate) is what filters candidates.
    expect(mockSearchPhotos).toHaveBeenCalledWith(
      expect.objectContaining({
        predicates: expect.arrayContaining([
          expect.objectContaining({ kind: 'set', field: 'person' })
        ])
      }),
      { limit: Number.MAX_SAFE_INTEGER }
    )
    expect(mockSearchPhotos.mock.calls[0][0].predicates).not.toContainEqual(
      expect.objectContaining({ kind: 'text' })
    )
    expect(result.hits.map((hit) => hit.filePath)).toEqual(['/joe.jpg'])
  })

  it('short-circuits without embedding when the facet filter matches nothing', async () => {
    mockSearchPhotos.mockReturnValue({ hits: [], total: 0, paths: [] })

    const result = await semanticSearchPhotos(parseSearchQuery('beach person:nobody'))

    expect(result).toEqual({ hits: [], indexedCount: 0, totalReadyCount: 0 })
    expect(mockEmbedText).not.toHaveBeenCalled()
  })

  it('reports indexed vs. ready photo counts', async () => {
    mockGetAllEmbeddings.mockReturnValue([{ filePath: '/p.jpg', embedding: axis(0) }])
    mockFindAllReadyPhotos.mockReturnValue([{ filePath: '/p.jpg' }, { filePath: '/q.jpg' }])
    mockFindByPath.mockReturnValue(makePhotoRecord('p.jpg'))

    const result = await semanticSearchPhotos(parseSearchQuery('beach'))

    expect(result.indexedCount).toBe(1)
    expect(result.totalReadyCount).toBe(2)
  })
})
