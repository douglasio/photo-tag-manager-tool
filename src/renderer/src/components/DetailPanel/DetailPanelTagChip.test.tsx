import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Rendered via the real TagHoverCard (not mocked) — it just needs a
// tagDescriptions map to read from.
vi.mock('@state', () => ({
  usePreviewTriggerHeld: () => false,
  usePhotoLibrary: () => ({
    state: { tagDescriptions: new Map() },
    tagCounts: new Map(),
    tagCoverPhotos: new Map(),
    tagViewCounts: new Map()
  }),
  // TagHoverCardTarget (rendered inside DetailPanelTagChip) reads this
  // context directly rather than through usePhotoLibrary.
  useSidebarLibrary: () => ({
    state: { tagDescriptions: new Map() },
    tagCounts: new Map(),
    tagCoverPhotos: new Map(),
    tagViewCounts: new Map()
  })
}))

import { DetailPanelTagChip } from './DetailPanelTagChip'

function renderChip(checked: boolean): void {
  render(
    <MantineProvider>
      <DetailPanelTagChip tag="vacation" checked={checked} />
    </MantineProvider>
  )
}

describe('DetailPanelTagChip', () => {
  it('does not show the remove (X) icon while unchecked, even on hover', async () => {
    const user = userEvent.setup()
    renderChip(false)

    await user.hover(screen.getByText('vacation'))

    expect(document.querySelector('.tabler-icon-x')).not.toBeInTheDocument()
  })

  it('does not show the remove (X) icon while checked but not hovered', () => {
    renderChip(true)

    expect(document.querySelector('.tabler-icon-x')).not.toBeInTheDocument()
  })

  it('shows the remove (X) icon only once a checked chip is hovered', async () => {
    const user = userEvent.setup()
    renderChip(true)

    await user.hover(screen.getByText('vacation'))
    expect(document.querySelector('.tabler-icon-x')).toBeInTheDocument()

    await user.unhover(screen.getByText('vacation'))
    expect(document.querySelector('.tabler-icon-x')).not.toBeInTheDocument()
  })
})
