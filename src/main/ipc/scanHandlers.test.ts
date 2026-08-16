// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

const {
  mockHandle,
  mockPruneMissing,
  mockGetExcludePatterns,
  mockScanDirectory,
  mockScanAllFolders,
  mockIngestMetadata,
  mockIngestThumbnail,
  mockDeleteThumbnail
} = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockPruneMissing: vi.fn().mockReturnValue([]),
  mockGetExcludePatterns: vi.fn().mockReturnValue([]),
  mockScanDirectory: vi.fn(),
  mockScanAllFolders: vi.fn().mockResolvedValue([]),
  mockIngestMetadata: vi.fn(),
  mockIngestThumbnail: vi.fn(),
  mockDeleteThumbnail: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('electron', () => ({ ipcMain: { handle: mockHandle } }))
vi.mock('@main/db/photoRepository', () => ({ pruneMissing: mockPruneMissing }))
vi.mock('@main/db/settingsRepository', () => ({ getExcludePatterns: mockGetExcludePatterns }))
vi.mock('@main/services/directoryScanner', () => ({
  scanDirectory: mockScanDirectory,
  scanAllFolders: mockScanAllFolders
}))
vi.mock('@main/services/photoIngest', () => ({
  ingestMetadata: mockIngestMetadata,
  ingestThumbnail: mockIngestThumbnail
}))
vi.mock('@main/services/thumbnailService', () => ({ deleteThumbnail: mockDeleteThumbnail }))

import { registerScanHandlers } from './scanHandlers'

function makePhoto(filePath: string, overrides: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: filePath,
    filePath,
    fileName: filePath.split('/').pop() ?? filePath,
    tags: [],
    metadata: {
      dateTaken: null,
      cameraMake: null,
      cameraModel: null,
      widthPx: null,
      heightPx: null,
      fileSizeBytes: 0,
      format: 'JPEG',
      comment: null
    },
    thumbnailStatus: 'ready',
    thumbnailKey: 'k',
    scanError: null,
    fromCache: false,
    viewCount: 0,
    ...overrides
  }
}

// Captures the ipcMain.handle(channel, fn) registrations so tests can invoke
// them directly, the same way the real preload -> ipcMain.invoke round trip would.
function getHandlers(): Map<string, (event: unknown, ...args: unknown[]) => unknown> {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
  mockHandle.mockImplementation((channel: string, fn: (...args: unknown[]) => unknown) => {
    handlers.set(channel, fn)
  })
  registerScanHandlers()
  return handlers
}

// Waits for any pending microtasks (promise chains inside the fire-and-forget
// runScan) to settle, without relying on real setInterval/setTimeout delays.
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
}

function makeFakeSender(): { send: ReturnType<typeof vi.fn> } {
  return { send: vi.fn() }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPruneMissing.mockReturnValue([])
  mockGetExcludePatterns.mockReturnValue([])
  mockScanAllFolders.mockResolvedValue([])
})

describe('scan:start', () => {
  it('returns a scanId synchronously, before the scan itself resolves', () => {
    const handlers = getHandlers()
    mockScanDirectory.mockReturnValue(new Promise(() => {})) // never resolves
    const sender = makeFakeSender()

    const result = handlers.get('scan:start')!({ sender }, '/root') as { scanId: string }

    expect(result.scanId).toEqual(expect.any(String))
  })
})

describe('runScan happy path', () => {
  it('sends progress, then metadata batches, then a complete event with the right totals', async () => {
    const handlers = getHandlers()
    mockScanDirectory.mockResolvedValue(['/root/a.jpg', '/root/b.jpg'])
    mockScanAllFolders.mockResolvedValue(['/root'])
    mockIngestMetadata.mockImplementation(async (filePath: string) => ({
      photo: makePhoto(filePath),
      fromCache: filePath === '/root/a.jpg',
      fileStat: { mtimeMs: 1, size: 1 }
    }))
    const sender = makeFakeSender()

    handlers.get('scan:start')!({ sender }, '/root')
    await flushMicrotasks()

    const progress = sender.send.mock.calls.find(([channel]) => channel === 'scan:progress')
    expect(progress?.[1]).toMatchObject({ filesFound: 2 })

    const complete = sender.send.mock.calls.find(([channel]) => channel === 'scan:complete')
    expect(complete?.[1]).toMatchObject({ totalScanned: 2, cacheHits: 1, errors: [] })

    const batches = sender.send.mock.calls.filter(([channel]) => channel === 'scan:metadata-batch')
    const batchedPaths = batches
      .flatMap(([, event]) => (event as { photos: PhotoRecord[] }).photos)
      .map((p) => p.filePath)
    expect(batchedPaths.sort()).toEqual(['/root/a.jpg', '/root/b.jpg'])
  })

  it('does not send scan:complete until a queued thumbnail task also resolves', async () => {
    const handlers = getHandlers()
    mockScanDirectory.mockResolvedValue(['/root/a.jpg'])
    mockScanAllFolders.mockResolvedValue(['/root'])
    mockIngestMetadata.mockResolvedValue({
      photo: makePhoto('/root/a.jpg', { thumbnailStatus: 'pending', thumbnailKey: null }),
      fromCache: false,
      fileStat: { mtimeMs: 1, size: 1 }
    })
    let resolveThumbnail: (photo: PhotoRecord) => void = () => {}
    mockIngestThumbnail.mockReturnValue(
      new Promise<PhotoRecord>((resolve) => {
        resolveThumbnail = resolve
      })
    )
    const sender = makeFakeSender()

    handlers.get('scan:start')!({ sender }, '/root')
    await flushMicrotasks()
    expect(sender.send.mock.calls.some(([channel]) => channel === 'scan:complete')).toBe(false)

    resolveThumbnail(makePhoto('/root/a.jpg'))
    await flushMicrotasks()
    expect(sender.send.mock.calls.some(([channel]) => channel === 'scan:complete')).toBe(true)
  })

  it('calls pruneMissing with every scanned root and the full set of seen paths', async () => {
    const handlers = getHandlers()
    mockScanDirectory.mockResolvedValue(['/root/a.jpg'])
    mockScanAllFolders.mockResolvedValue(['/root'])
    mockIngestMetadata.mockResolvedValue({
      photo: makePhoto('/root/a.jpg'),
      fromCache: true,
      fileStat: { mtimeMs: 1, size: 1 }
    })
    const sender = makeFakeSender()

    handlers.get('scan:start')!({ sender }, '/root')
    await flushMicrotasks()

    expect(mockPruneMissing).toHaveBeenCalledWith('/root', new Set(['/root/a.jpg']))
  })
})

describe('runScan error handling', () => {
  it('sends a complete event with errors and filePaths: null when enumeration itself fails, and skips pruneMissing', async () => {
    const handlers = getHandlers()
    mockScanDirectory.mockRejectedValue(new Error('permission denied'))
    const sender = makeFakeSender()

    handlers.get('scan:start')!({ sender }, '/root')
    await flushMicrotasks()

    const complete = sender.send.mock.calls.find(([channel]) => channel === 'scan:complete')
    expect(complete?.[1]).toMatchObject({
      totalScanned: 0,
      filePaths: null,
      errors: [{ filePath: '/root', message: 'permission denied' }]
    })
    expect(mockPruneMissing).not.toHaveBeenCalled()
  })

  it('records a per-file error without aborting the rest of the scan', async () => {
    const handlers = getHandlers()
    mockScanDirectory.mockResolvedValue(['/root/good.jpg', '/root/bad.jpg'])
    mockScanAllFolders.mockResolvedValue(['/root'])
    mockIngestMetadata.mockImplementation(async (filePath: string) => {
      if (filePath.includes('bad')) throw new Error('corrupt file')
      return { photo: makePhoto(filePath), fromCache: true, fileStat: { mtimeMs: 1, size: 1 } }
    })
    const sender = makeFakeSender()

    handlers.get('scan:start')!({ sender }, '/root')
    await flushMicrotasks()

    const complete = sender.send.mock.calls.find(([channel]) => channel === 'scan:complete')
    expect(complete?.[1]).toMatchObject({
      totalScanned: 2,
      errors: [{ filePath: '/root/bad.jpg', message: 'corrupt file' }]
    })
  })
})

describe('scan:cancel', () => {
  it('stops a running scan from completing normally, and skips pruneMissing', async () => {
    const handlers = getHandlers()
    mockScanDirectory.mockResolvedValue(['/root/a.jpg', '/root/b.jpg'])
    mockScanAllFolders.mockResolvedValue(['/root'])
    let resolveFirst: (v: unknown) => void = () => {}
    mockIngestMetadata.mockImplementation((filePath: string) => {
      if (filePath === '/root/a.jpg') {
        return new Promise((resolve) => {
          resolveFirst = () =>
            resolve({
              photo: makePhoto(filePath),
              fromCache: true,
              fileStat: { mtimeMs: 1, size: 1 }
            })
        })
      }
      return Promise.resolve({
        photo: makePhoto(filePath),
        fromCache: true,
        fileStat: { mtimeMs: 1, size: 1 }
      })
    })
    const sender = makeFakeSender()

    const { scanId } = handlers.get('scan:start')!({ sender }, '/root') as { scanId: string }
    await flushMicrotasks()

    handlers.get('scan:cancel')!({}, scanId)
    resolveFirst({})
    await flushMicrotasks()

    expect(mockPruneMissing).not.toHaveBeenCalled()
  })
})
