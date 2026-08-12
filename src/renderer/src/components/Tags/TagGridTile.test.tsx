import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoRecord } from '@shared/types'

// TagHoverCard's own hover/description behavior has its own test coverage —
// a plain passthrough here keeps these tests focused on the tile itself.
vi.mock('@components', () => ({
  PhotoGradientOverlay: () => null,
  TagHoverCard: ({ children }: { children: ReactNode }) => children
}))

import { TagGridTile } from './TagGridTile'

function makePhoto(overrides: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: '/a.jpg',
    filePath: '/a.jpg',
    fileName: 'a.jpg',
    tags: ['vacation'],
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
    ...overrides
  }
}

function renderTile(overrides: Partial<Parameters<typeof TagGridTile>[0]> = {}): {
  onSelect: ReturnType<typeof vi.fn>
} {
  const onSelect = vi.fn()
  render(
    <MantineProvider>
      <TagGridTile
        tag="vacation"
        count={3}
        coverPhoto={makePhoto()}
        isActive={false}
        draggable={false}
        onSelect={onSelect}
        {...overrides}
      />
    </MantineProvider>
  )
  return { onSelect }
}

describe('TagGridTile', () => {
  it('renders the tag name and photo count', () => {
    renderTile()
    expect(screen.getByText('#vacation')).toBeInTheDocument()
    expect(screen.getByText('3 photos')).toBeInTheDocument()
  })

  it('uses singular "photo" for a count of one', () => {
    renderTile({ count: 1 })
    expect(screen.getByText('1 photo')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderTile()

    await user.click(screen.getByText('#vacation'))

    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('renders without a background image when there is no ready thumbnail', () => {
    renderTile({ coverPhoto: undefined })
    expect(screen.getByText('#vacation')).toBeInTheDocument()
  })

  it('renders without crashing when draggable (dnd-kit wired up)', () => {
    renderTile({ draggable: true })
    expect(screen.getByText('#vacation')).toBeInTheDocument()
  })
})
