import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The setTimeout callback that flips `opened` fires outside of any React
// event handler, so vi.advanceTimersByTime alone won't flush that state
// update to the DOM before an assertion runs right after it — act() forces
// that flush.
function advanceTimers(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

let mockTagDescriptions: Map<string, string>

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    state: { tagDescriptions: mockTagDescriptions }
  })
}))

import { TagHoverCard, TagHoverCardContent } from './TagHoverCard'

function renderCard(tag: string): { hoverTarget: Element } {
  const { container } = render(
    <MantineProvider>
      <TagHoverCard tag={tag}>
        <button>#{tag}</button>
      </TagHoverCard>
    </MantineProvider>
  )
  // useHover's mouseenter/mouseleave listeners live on TagHoverCard's own
  // wrapping <span> (Popover.Target), not the button inside it — those
  // events don't bubble, so firing them on the button itself wouldn't reach
  // the listener the way a real pointer entering the span from outside would.
  return { hoverTarget: container.querySelector('span')! }
}

describe('TagHoverCard', () => {
  beforeEach(() => {
    mockTagDescriptions = new Map()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('always renders the wrapped children', () => {
    renderCard('vacation')

    expect(screen.getByRole('button', { name: '#vacation' })).toBeInTheDocument()
  })

  it('does not show the popover with no hover at all', () => {
    renderCard('vacation')
    advanceTimers(1000)

    expect(screen.getAllByText('#vacation')).toHaveLength(1)
  })

  it('does not show the popover before the hover delay elapses', () => {
    const { hoverTarget } = renderCard('vacation')

    fireEvent.mouseEnter(hoverTarget)
    advanceTimers(699)

    // Only the wrapped button's own "#vacation" label exists yet — the
    // popover dropdown (which would add a second one) hasn't opened.
    expect(screen.getAllByText('#vacation')).toHaveLength(1)
  })

  it('opens the popover after hovering past the delay', () => {
    // Mantine's Popover.Dropdown renders into a portal via floating-ui,
    // whose positioning never fully settles under jsdom — aria-expanded is
    // what actually reflects our own opened state, so that's what's
    // asserted here; the dropdown's own content is covered separately by
    // the TagHoverCardContent tests below.
    mockTagDescriptions = new Map()
    const { hoverTarget } = renderCard('vacation')
    expect(hoverTarget).toHaveAttribute('aria-expanded', 'false')

    fireEvent.mouseEnter(hoverTarget)
    advanceTimers(700)

    expect(hoverTarget).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens the popover after hovering past the delay when a description exists too', () => {
    mockTagDescriptions = new Map([['vacation', 'Photos from trips']])
    const { hoverTarget } = renderCard('vacation')

    fireEvent.mouseEnter(hoverTarget)
    advanceTimers(700)

    expect(hoverTarget).toHaveAttribute('aria-expanded', 'true')
  })

  it('cancels the pending open if the mouse leaves before the delay elapses', () => {
    mockTagDescriptions = new Map([['vacation', 'Photos from trips']])
    const { hoverTarget } = renderCard('vacation')

    fireEvent.mouseEnter(hoverTarget)
    advanceTimers(400)
    fireEvent.mouseLeave(hoverTarget)
    advanceTimers(700)

    expect(screen.queryByText('Photos from trips')).not.toBeInTheDocument()
  })
})

describe('TagHoverCardContent', () => {
  it('renders just the tag name when there is no description', () => {
    render(
      <MantineProvider>
        <TagHoverCardContent tag="vacation" />
      </MantineProvider>
    )

    expect(screen.getByText('#vacation')).toBeInTheDocument()
  })

  it('renders the tag name and description together when one exists', () => {
    render(
      <MantineProvider>
        <TagHoverCardContent tag="vacation" description="Photos from trips" />
      </MantineProvider>
    )

    expect(screen.getByText('#vacation')).toBeInTheDocument()
    expect(screen.getByText('Photos from trips')).toBeInTheDocument()
  })
})
