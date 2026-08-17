import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// TagHoverCard (wrapping each pill via renderPill) needs a tagDescriptions map.
vi.mock('@state', () => ({
  useSidebarLibrary: () => ({
    state: { tagDescriptions: new Map() },
    tagCounts: new Map(),
    tagCoverPhotos: new Map(),
    tagViewCounts: new Map()
  })
}))

import { TagList } from './TagList'

function renderTagList(
  tags: string[],
  onChange = vi.fn()
): { onChange: typeof onChange; container: HTMLElement } {
  const { container } = render(
    <MantineProvider>
      <TagList tags={tags} allTags={['vacation', 'family']} recentTags={[]} onChange={onChange} />
    </MantineProvider>
  )
  return { onChange, container }
}

describe('TagList', () => {
  it('renders a pill for each applied tag', () => {
    renderTagList(['vacation', 'family'])

    expect(screen.getByText('vacation')).toBeInTheDocument()
    expect(screen.getByText('family')).toBeInTheDocument()
  })

  it('removes a tag when its pill remove button is clicked', async () => {
    const user = userEvent.setup()
    const { onChange, container } = renderTagList(['vacation', 'family'])

    // Mantine's Pill remove button is aria-hidden (removal is meant to be
    // driven by backspace/keyboard for a11y), so it isn't queryable by role
    // — pills render in `tags` order, so the first one is vacation's own.
    const removeButton = container.querySelector('.mantine-Pill-remove')!
    await user.click(removeButton)

    expect(onChange).toHaveBeenCalledExactlyOnceWith(['family'])
  })
})
