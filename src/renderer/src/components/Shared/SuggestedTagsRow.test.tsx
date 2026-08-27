import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// TagHoverCard (wrapping each suggestion badge) needs a tagDescriptions map.
vi.mock('@state', () => ({
  usePreviewTriggerHeld: () => false,
  usePhotoLibrary: () => ({
    state: { tagDescriptions: new Map() },
    tagCounts: new Map(),
    tagCoverPhotos: new Map(),
    tagViewCounts: new Map()
  }),
  // TagHoverCardTarget (rendered inside the badges here) reads this context
  // directly rather than through usePhotoLibrary.
  useSidebarLibrary: () => ({
    state: { tagDescriptions: new Map() },
    tagCounts: new Map(),
    tagCoverPhotos: new Map(),
    tagViewCounts: new Map()
  })
}))

import { SuggestedTagsRow } from './SuggestedTagsRow'

describe('SuggestedTagsRow', () => {
  it('renders nothing when not loading and there are no suggestions', () => {
    render(
      <MantineProvider>
        <SuggestedTagsRow suggestions={[]} loading={false} onAccept={vi.fn()} />
      </MantineProvider>
    )

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument()
  })

  it('shows a loader while loading', () => {
    render(
      <MantineProvider>
        <SuggestedTagsRow suggestions={[]} loading onAccept={vi.fn()} />
      </MantineProvider>
    )

    expect(screen.getByText('Suggested')).toBeInTheDocument()
  })

  it('renders a badge per suggestion', () => {
    render(
      <MantineProvider>
        <SuggestedTagsRow
          suggestions={[
            { tag: 'vacation', score: 0.9 },
            { tag: 'family', score: 0.4 }
          ]}
          loading={false}
          onAccept={vi.fn()}
        />
      </MantineProvider>
    )

    expect(screen.getByText('+ vacation')).toBeInTheDocument()
    expect(screen.getByText('+ family')).toBeInTheDocument()
  })

  it('calls onAccept with the clicked tag', async () => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    render(
      <MantineProvider>
        <SuggestedTagsRow
          suggestions={[{ tag: 'vacation', score: 0.9 }]}
          loading={false}
          onAccept={onAccept}
        />
      </MantineProvider>
    )

    await user.click(screen.getByText('+ vacation'))

    expect(onAccept).toHaveBeenCalledExactlyOnceWith('vacation')
  })
})
