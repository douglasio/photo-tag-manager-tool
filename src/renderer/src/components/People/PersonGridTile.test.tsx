import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PersonGridTile } from './PersonGridTile'

function renderTile(overrides: Partial<Parameters<typeof PersonGridTile>[0]> = {}): {
  onSelect: ReturnType<typeof vi.fn>
} {
  const onSelect = vi.fn()
  render(
    <MantineProvider>
      <PersonGridTile
        name="Jamie"
        faceCount={3}
        coverThumbnailKey="key1"
        coverFaceBox={{ x: 0.1, y: 0.1, w: 0.5, h: 0.5 }}
        isActive={false}
        onSelect={onSelect}
        {...overrides}
      />
    </MantineProvider>
  )
  return { onSelect }
}

describe('PersonGridTile', () => {
  it('renders the person name and face count', () => {
    renderTile()
    expect(screen.getByText('Jamie')).toBeInTheDocument()
    expect(screen.getByText('3 faces')).toBeInTheDocument()
  })

  it('uses singular "face" for a count of one', () => {
    renderTile({ faceCount: 1 })
    expect(screen.getByText('1 face')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderTile()

    await user.click(screen.getByText('Jamie'))

    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('renders without a background image when there is no cover thumbnail', () => {
    renderTile({ coverThumbnailKey: null })
    expect(screen.getByText('Jamie')).toBeInTheDocument()
  })
})
