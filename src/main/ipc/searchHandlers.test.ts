// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { parseSearchQuery } from '@shared/searchQuery'

const { mockHandle, mockSearchPhotos, mockSemanticSearchPhotos } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockSearchPhotos: vi.fn().mockReturnValue({ hits: [], total: 0, paths: [] }),
  mockSemanticSearchPhotos: vi
    .fn()
    .mockResolvedValue({ hits: [], indexedCount: 0, totalReadyCount: 0 })
}))

vi.mock('electron', () => ({ ipcMain: { handle: mockHandle } }))
vi.mock('@main/db/searchRepository', () => ({ searchPhotos: mockSearchPhotos }))
vi.mock('@main/services/semanticSearchService', () => ({
  semanticSearchPhotos: mockSemanticSearchPhotos
}))

import { registerSearchHandlers } from './searchHandlers'

function getHandlers(): Map<string, (event: unknown, ...args: unknown[]) => unknown> {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
  mockHandle.mockImplementation((channel: string, fn: (...args: unknown[]) => unknown) => {
    handlers.set(channel, fn)
  })
  registerSearchHandlers()
  return handlers
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchPhotos.mockReturnValue({ hits: [], total: 0, paths: [] })
  mockSemanticSearchPhotos.mockResolvedValue({ hits: [], indexedCount: 0, totalReadyCount: 0 })
})

describe('registerSearchHandlers', () => {
  it('registers exactly the two channels the preload API invokes', () => {
    expect([...getHandlers().keys()]).toEqual(['search:query', 'search:semantic'])
  })

  it('passes the parsed query straight through to the semantic search service', async () => {
    const handler = getHandlers().get('search:semantic')!
    const query = parseSearchQuery('beach sunset')

    await handler({ sender: { send: vi.fn() } }, query)

    expect(mockSemanticSearchPhotos).toHaveBeenCalledWith(query, expect.any(Function))
  })

  it('forwards a semantic model-download progress tick to the requesting webContents', async () => {
    const handler = getHandlers().get('search:semantic')!
    const send = vi.fn()

    await handler({ sender: { send } }, parseSearchQuery('beach'))

    const onProgress = mockSemanticSearchPhotos.mock.calls[0][1] as (progress: number) => void
    onProgress(42)

    expect(send).toHaveBeenCalledWith('search:semanticModelProgress', 42)
  })

  it('passes the parsed query and limit straight through to the repository', () => {
    const handler = getHandlers().get('search:query')!
    const query = parseSearchQuery('tag:beach person:joe')

    handler({}, query, 25)

    expect(mockSearchPhotos).toHaveBeenCalledWith(query, { limit: 25 })
  })

  it('returns the repository result unchanged', () => {
    const result = {
      hits: [{ filePath: '/a.jpg', fileName: 'a.jpg', score: 7.5, thumbnailKey: 'k' }],
      total: 1,
      paths: ['/a.jpg']
    }
    mockSearchPhotos.mockReturnValue(result)

    expect(getHandlers().get('search:query')!({}, parseSearchQuery('a'), 10)).toEqual(result)
  })

  it('carries the includeExcluded flag rather than dropping it', () => {
    const handler = getHandlers().get('search:query')!
    handler({}, parseSearchQuery('beach', true), 10)

    expect(mockSearchPhotos.mock.calls[0][0]).toMatchObject({ includeExcluded: true })
  })
})
