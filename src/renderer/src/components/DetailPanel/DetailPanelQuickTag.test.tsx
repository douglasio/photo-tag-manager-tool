import { MantineProvider } from '@mantine/core'
import type { DisplayPhotoRecord } from '@state'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toDisplayMetadata } from '@utils'

let mockAllTags: string[]
const mockUpdateTags = vi.fn()

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    allTags: mockAllTags,
    updateTags: mockUpdateTags
  })
}))

import { DetailPanelQuickTag } from './DetailPanelQuickTag'

function makePhoto(tags: string[]): DisplayPhotoRecord {
  return {
    id: '/a.jpg',
    filePath: '/a.jpg',
    fileName: 'a.jpg',
    tags,
    metadata: toDisplayMetadata({
      dateTaken: null,
      cameraMake: null,
      cameraModel: null,
      widthPx: null,
      heightPx: null,
      fileSizeBytes: 0,
      format: 'JPEG',
      comment: null
    }),
    thumbnailStatus: 'ready',
    thumbnailKey: 'key',
    scanError: null,
    fromCache: false,
    viewCount: 0
  }
}

function renderQuickTag(tags: string[], onClose = vi.fn()): { onClose: typeof onClose } {
  render(
    <MantineProvider>
      <DetailPanelQuickTag photo={makePhoto(tags)} onClose={onClose} />
    </MantineProvider>
  )
  return { onClose }
}

describe('DetailPanelQuickTag', () => {
  beforeEach(() => {
    mockUpdateTags.mockClear()
  })

  it('shows every known tag as a chip, pre-checking ones already on the photo', () => {
    mockAllTags = ['vacation', 'family', 'work']
    renderQuickTag(['vacation'])

    expect(screen.getByRole('checkbox', { name: 'vacation' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'family' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'work' })).not.toBeChecked()
  })

  it('adds a tag instantly when its chip is checked', async () => {
    mockAllTags = ['vacation', 'family']
    const user = userEvent.setup()
    renderQuickTag(['vacation'])

    await user.click(screen.getByRole('checkbox', { name: 'family' }))

    expect(mockUpdateTags).toHaveBeenCalledExactlyOnceWith('/a.jpg', ['vacation', 'family'])
  })

  it('removes a tag instantly when its chip is unchecked', async () => {
    mockAllTags = ['vacation', 'family']
    const user = userEvent.setup()
    renderQuickTag(['vacation', 'family'])

    await user.click(screen.getByRole('checkbox', { name: 'vacation' }))

    expect(mockUpdateTags).toHaveBeenCalledExactlyOnceWith('/a.jpg', ['family'])
  })

  it('shows an empty-state message when no tags exist yet', () => {
    mockAllTags = []
    renderQuickTag([])

    expect(screen.getByText('No tags yet — add one from the Tags panel first.')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    mockAllTags = ['vacation']
    const user = userEvent.setup()
    const { onClose } = renderQuickTag([])

    await user.click(screen.getByRole('button', { name: 'Close quick tag' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
