import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DuplicateGroup, PhotoRecord } from '@shared/types'

let mockAiTagSuggestionsEnabled: boolean
let mockPhotosByPath: Map<string, PhotoRecord>
const mockRescanAiFeatures = vi.fn()
const mockDeletePhotos = vi.fn().mockResolvedValue(undefined)
const mockDismissDuplicateGroup = vi.fn().mockResolvedValue(undefined)
const mockOpenPhotoTab = vi.fn()
const mockShowItemInFolder = vi.fn()

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: {
      aiTagSuggestionsEnabled: mockAiTagSuggestionsEnabled,
      aiScanProgress: null,
      galleryAnimationsEnabled: false,
      photosByPath: mockPhotosByPath
    },
    rescanAiFeatures: mockRescanAiFeatures,
    enableAiFeatures: vi.fn(),
    cancelAiScan: vi.fn(),
    openPhotoTab: mockOpenPhotoTab,
    dismissDuplicateGroup: mockDismissDuplicateGroup,
    deletePhotos: mockDeletePhotos,
    incrementViewCount: vi.fn()
  })
}))

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
    thumbnailKey: 'key',
    scanError: null,
    fromCache: false,
    viewCount: 0,
    mtimeMs: new Date('2024-03-05T14:30:00').getTime(),
    ...overrides
  }
}

async function renderView(groups: DuplicateGroup[]): Promise<void> {
  mockRescanAiFeatures.mockResolvedValue({ duplicateGroups: groups, canceled: false })
  // Module-level cache lives outside the component — reset the module so
  // each test starts from a clean, un-cached slate.
  vi.resetModules()
  const { DuplicatesView } = await import('./DuplicatesView')
  render(
    <MantineProvider>
      <DuplicatesView />
    </MantineProvider>
  )
  await waitFor(() => expect(mockRescanAiFeatures).toHaveBeenCalled())
}

describe('DuplicatesView', () => {
  beforeEach(() => {
    mockAiTagSuggestionsEnabled = true
    mockPhotosByPath = new Map()
    mockRescanAiFeatures.mockReset()
    mockDeletePhotos.mockClear().mockResolvedValue(undefined)
    mockDismissDuplicateGroup.mockClear().mockResolvedValue(undefined)
    mockOpenPhotoTab.mockClear()
    mockShowItemInFolder.mockClear()
    vi.stubGlobal(
      'window',
      Object.assign(window, { api: { showItemInFolder: mockShowItemInFolder } })
    )
  })

  it('shows the AI-disabled gate instead of scanning', async () => {
    mockAiTagSuggestionsEnabled = false
    vi.resetModules()
    const { DuplicatesView } = await import('./DuplicatesView')
    render(
      <MantineProvider>
        <DuplicatesView />
      </MantineProvider>
    )

    expect(
      screen.getByText('Duplicate detection requires AI features to be enabled.')
    ).toBeInTheDocument()
    expect(mockRescanAiFeatures).not.toHaveBeenCalled()
  })

  it('shows full filepath, filename, and date modified for each photo at a glance', async () => {
    const photoA = makePhoto('/root/a.jpg')
    const photoB = makePhoto('/root/nested/b.jpg')
    mockPhotosByPath = new Map([
      [photoA.filePath, photoA],
      [photoB.filePath, photoB]
    ])
    await renderView([{ filePaths: [photoA.filePath, photoB.filePath], similarity: 0.99 }])

    expect(await screen.findByText('a.jpg')).toBeInTheDocument()
    expect(screen.getByText('/root/a.jpg')).toBeInTheDocument()
    expect(screen.getByText('/root/nested/b.jpg')).toBeInTheDocument()
    expect(screen.getAllByText(/Modified Mar 5, 2024/)).toHaveLength(2)
  })

  it('shows a photo in Finder/Explorer when that action is clicked', async () => {
    const photo = makePhoto('/root/a.jpg')
    mockPhotosByPath = new Map([[photo.filePath, photo]])
    await renderView([{ filePaths: [photo.filePath, '/root/b.jpg'], similarity: 0.99 }])

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Show a.jpg in folder' }))

    expect(mockShowItemInFolder).toHaveBeenCalledExactlyOnceWith('/root/a.jpg')
  })

  it('dismisses a group: persists it and removes the card immediately', async () => {
    const photoA = makePhoto('/root/a.jpg')
    const photoB = makePhoto('/root/b.jpg')
    mockPhotosByPath = new Map([
      [photoA.filePath, photoA],
      [photoB.filePath, photoB]
    ])
    await renderView([{ filePaths: [photoA.filePath, photoB.filePath], similarity: 0.99 }])

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Dismiss' }))

    expect(mockDismissDuplicateGroup).toHaveBeenCalledExactlyOnceWith([
      photoA.filePath,
      photoB.filePath
    ])
    expect(screen.queryByText('a.jpg')).not.toBeInTheDocument()
    expect(screen.getByText('No duplicates found.')).toBeInTheDocument()
  })

  it('deleting a photo removes just that row, keeping the group if 2+ photos remain', async () => {
    const photoA = makePhoto('/root/a.jpg')
    const photoB = makePhoto('/root/b.jpg')
    const photoC = makePhoto('/root/c.jpg')
    mockPhotosByPath = new Map([
      [photoA.filePath, photoA],
      [photoB.filePath, photoB],
      [photoC.filePath, photoC]
    ])
    await renderView([
      { filePaths: [photoA.filePath, photoB.filePath, photoC.filePath], similarity: 0.99 }
    ])

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete a.jpg' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mockDeletePhotos).toHaveBeenCalledExactlyOnceWith(['/root/a.jpg']))
    expect(screen.queryByText('a.jpg')).not.toBeInTheDocument()
    expect(screen.getByText('b.jpg')).toBeInTheDocument()
    expect(screen.getByText('c.jpg')).toBeInTheDocument()
  })

  it('deleting down to one photo collapses the whole group', async () => {
    const photoA = makePhoto('/root/a.jpg')
    const photoB = makePhoto('/root/b.jpg')
    mockPhotosByPath = new Map([
      [photoA.filePath, photoA],
      [photoB.filePath, photoB]
    ])
    await renderView([{ filePaths: [photoA.filePath, photoB.filePath], similarity: 0.99 }])

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete a.jpg' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.getByText('No duplicates found.')).toBeInTheDocument())
    expect(screen.queryByText('b.jpg')).not.toBeInTheDocument()
  })
})
