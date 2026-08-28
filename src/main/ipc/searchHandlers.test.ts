// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { parseSearchQuery } from '@shared/searchQuery'

const { mockHandle, mockSearchPhotos } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockSearchPhotos: vi.fn().mockReturnValue({ hits: [], total: 0, paths: [] })
}))

vi.mock('electron', () => ({ ipcMain: { handle: mockHandle } }))
vi.mock('@main/db/searchRepository', () => ({ searchPhotos: mockSearchPhotos }))

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
})

describe('registerSearchHandlers', () => {
  it('registers exactly the one channel the preload API invokes', () => {
    expect([...getHandlers().keys()]).toEqual(['search:query'])
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
