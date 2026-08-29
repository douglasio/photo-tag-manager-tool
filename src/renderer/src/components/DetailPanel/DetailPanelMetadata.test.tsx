import { MantineProvider } from '@mantine/core'
import type { DisplayPhotoRecord } from '@state'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoMetadata } from '@shared/types'
import { toDisplayMetadata } from '@utils'

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({ updateDateTaken: vi.fn() })
}))

import { DetailPanelMetadata } from './DetailPanelMetadata'

const metadata: PhotoMetadata = {
  dateTaken: '2020-03-05T14:30:00',
  cameraMake: 'Canon',
  cameraModel: 'EOS 5D',
  widthPx: 4000,
  heightPx: 3000,
  fileSizeBytes: 2_500_000,
  format: 'JPEG',
  comment: null
}

function makePhoto(): DisplayPhotoRecord {
  return {
    id: '/a.jpg',
    filePath: '/a.jpg',
    fileName: 'a.jpg',
    tags: [],
    metadata: toDisplayMetadata(metadata),
    thumbnailStatus: 'ready',
    thumbnailKey: 'key',
    scanError: null,
    fromCache: false,
    viewCount: 0
  }
}

function renderMetadata(): void {
  render(
    <MantineProvider>
      <DetailPanelMetadata photo={makePhoto()} />
    </MantineProvider>
  )
}

describe('DetailPanelMetadata', () => {
  it('starts expanded', () => {
    renderMetadata()

    expect(screen.getByRole('button', { name: 'Collapse metadata' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByText('Camera Make')).toBeInTheDocument()
  })

  // Asserted via aria-expanded rather than visibility: Mantine's Collapse
  // keeps its children mounted, so presence in the DOM proves nothing here.
  it('toggles collapsed and back on header clicks', async () => {
    const user = userEvent.setup()
    renderMetadata()

    await user.click(screen.getByRole('button', { name: 'Collapse metadata' }))
    expect(screen.getByRole('button', { name: 'Expand metadata' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )

    await user.click(screen.getByRole('button', { name: 'Expand metadata' }))
    expect(screen.getByRole('button', { name: 'Collapse metadata' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })
})
