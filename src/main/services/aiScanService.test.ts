// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAiScanInProgress,
  mockGetAiTagSuggestionsEnabled,
  mockSetAiScanInProgress,
  mockSetAiTagSuggestionsEnabled,
  mockClusterDuplicates,
  mockEmbedAllReadyPhotos,
  mockEnsureModelReady,
  mockDisposeTagSuggestionWorker
} = vi.hoisted(() => ({
  mockGetAiScanInProgress: vi.fn(),
  mockGetAiTagSuggestionsEnabled: vi.fn(),
  mockSetAiScanInProgress: vi.fn(),
  mockSetAiTagSuggestionsEnabled: vi.fn(),
  mockClusterDuplicates: vi.fn(),
  mockEmbedAllReadyPhotos: vi.fn(),
  mockEnsureModelReady: vi.fn(),
  mockDisposeTagSuggestionWorker: vi.fn()
}))

vi.mock('@main/db/settingsRepository', () => ({
  getAiScanInProgress: mockGetAiScanInProgress,
  getAiTagSuggestionsEnabled: mockGetAiTagSuggestionsEnabled,
  setAiScanInProgress: mockSetAiScanInProgress,
  setAiTagSuggestionsEnabled: mockSetAiTagSuggestionsEnabled
}))
vi.mock('./duplicatePhotoService', () => ({ clusterDuplicates: mockClusterDuplicates }))
vi.mock('./photoEmbedding', () => ({ embedAllReadyPhotos: mockEmbedAllReadyPhotos }))
vi.mock('./tagSuggestionService', () => ({
  ensureModelReady: mockEnsureModelReady,
  disposeTagSuggestionWorker: mockDisposeTagSuggestionWorker
}))

import { cancelAiScan, enableAiFeaturesAndScan, runFullAiScan } from './aiScanService'

describe('runFullAiScan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbedAllReadyPhotos.mockResolvedValue([])
    mockClusterDuplicates.mockResolvedValue({ groups: [], canceled: false })
  })

  it('marks the scan in progress and clears it when finished', async () => {
    await runFullAiScan()

    const setCalls = mockSetAiScanInProgress.mock.calls.map((call) => call[0])
    expect(setCalls).toEqual([true, false])
  })

  it('clears the in-progress flag even if clustering throws', async () => {
    mockClusterDuplicates.mockRejectedValue(new Error('worker crashed'))

    await expect(runFullAiScan()).rejects.toThrow('worker crashed')

    expect(mockSetAiScanInProgress).toHaveBeenLastCalledWith(false)
  })

  it('stops before clustering once cancelAiScan is called mid-embedding', async () => {
    mockEmbedAllReadyPhotos.mockImplementation(
      async (_onProgress?: unknown, isCancelled?: () => boolean) => {
        cancelAiScan()
        expect(isCancelled?.()).toBe(true)
        return []
      }
    )

    const result = await runFullAiScan()

    expect(result).toEqual({ duplicateGroups: [], photosScanned: 0, canceled: true })
    expect(mockClusterDuplicates).not.toHaveBeenCalled()
  })
})

describe('enableAiFeaturesAndScan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbedAllReadyPhotos.mockResolvedValue([])
    mockClusterDuplicates.mockResolvedValue({ groups: [], canceled: false })
  })

  it('downloads the model, enables the setting, then runs the scan', async () => {
    mockEnsureModelReady.mockResolvedValue(undefined)

    const result = await enableAiFeaturesAndScan()

    expect(mockSetAiTagSuggestionsEnabled).toHaveBeenCalledWith(true)
    expect(result).toEqual({ duplicateGroups: [], photosScanned: 0, canceled: false })
  })

  it('cancelAiScan during download disposes the worker and resolves canceled without enabling the setting', async () => {
    mockEnsureModelReady.mockImplementation(async (onProgress?: (p: number) => void) => {
      onProgress?.(10)
      cancelAiScan()
      throw new Error('AI tag suggestions disabled')
    })
    mockDisposeTagSuggestionWorker.mockResolvedValue(undefined)

    const result = await enableAiFeaturesAndScan()

    expect(mockDisposeTagSuggestionWorker).toHaveBeenCalled()
    expect(result).toEqual({ duplicateGroups: [], photosScanned: 0, canceled: true })
    expect(mockSetAiTagSuggestionsEnabled).not.toHaveBeenCalled()
  })

  it('re-throws a genuine download failure that was not a cancellation', async () => {
    mockEnsureModelReady.mockRejectedValue(new Error('network error'))

    await expect(enableAiFeaturesAndScan()).rejects.toThrow('network error')
    expect(mockSetAiTagSuggestionsEnabled).not.toHaveBeenCalled()
  })

  it('cancelAiScan is a no-op once a scan has actually started (model already loaded)', async () => {
    mockEnsureModelReady.mockResolvedValue(undefined)
    mockEmbedAllReadyPhotos.mockImplementation(async () => {
      cancelAiScan()
      return []
    })

    await enableAiFeaturesAndScan()

    expect(mockDisposeTagSuggestionWorker).not.toHaveBeenCalled()
  })
})

describe('wasAiScanInterrupted', () => {
  it('is true only when AI is enabled and a scan was left in progress', async () => {
    const { wasAiScanInterrupted } = await import('./aiScanService')

    mockGetAiTagSuggestionsEnabled.mockReturnValue(true)
    mockGetAiScanInProgress.mockReturnValue(true)
    expect(wasAiScanInterrupted()).toBe(true)

    mockGetAiTagSuggestionsEnabled.mockReturnValue(false)
    mockGetAiScanInProgress.mockReturnValue(true)
    expect(wasAiScanInterrupted()).toBe(false)
  })
})
