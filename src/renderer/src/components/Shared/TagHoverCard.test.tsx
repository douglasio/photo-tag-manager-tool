import { type ReactElement, useRef } from 'react'

import { MantineProvider, type TooltipProps } from '@mantine/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Tooltip's `target` mode never actually mounts its floating content into
// the portal under jsdom (the same "floating-ui doesn't settle" limitation
// as Popover below, but here it blocks rendering entirely rather than just
// mispositioning it) — stubbed so TagHoverCardTarget's own hover-delay
// logic is what's under test, not floating-ui's jsdom support.
vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core')
  return {
    ...actual,
    Tooltip: ({ opened, label }: TooltipProps) => (opened ? <>{label}</> : null)
  }
})

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
let mockTagCounts: Map<string, number>
let mockTagCoverPhotos: Map<
  string,
  { fileName: string; thumbnailStatus: string; thumbnailKey: string | null }
>
let mockTagViewCounts: Map<string, number>

vi.mock('@state', () => ({
  usePreviewTriggerHeld: () => false,
  useSidebarLibrary: () => ({
    state: { tagDescriptions: mockTagDescriptions },
    tagCounts: mockTagCounts,
    tagCoverPhotos: mockTagCoverPhotos,
    tagViewCounts: mockTagViewCounts
  })
}))

import type { PhotoRecord } from '@shared/types'

import { TagHoverCard, TagHoverCardBody, TagHoverCardTarget } from './TagHoverCard'

function makePhoto(overrides: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: 'beach.jpg',
    filePath: '/root/beach.jpg',
    fileName: 'beach.jpg',
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
    thumbnailKey: 'thumb-1',
    scanError: null,
    fromCache: false,
    viewCount: 0,
    ...overrides
  }
}

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
    mockTagCounts = new Map()
    mockTagCoverPhotos = new Map()
    mockTagViewCounts = new Map()
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
    // the TagHoverCardBody tests below.
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

function TargetHarness({ tag, disabled }: { tag: string; disabled?: boolean }): ReactElement {
  const target = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={target}>#{tag}</button>
      <TagHoverCardTarget tag={tag} target={target} disabled={disabled} />
    </>
  )
}

describe('TagHoverCardTarget', () => {
  beforeEach(() => {
    mockTagDescriptions = new Map()
    mockTagCounts = new Map()
    mockTagCoverPhotos = new Map()
    mockTagViewCounts = new Map()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the rich card after hovering the target past the delay', () => {
    mockTagDescriptions = new Map([['vacation', 'Photos from trips']])
    render(
      <MantineProvider>
        <TargetHarness tag="vacation" />
      </MantineProvider>
    )

    fireEvent.mouseEnter(screen.getByRole('button', { name: '#vacation' }))
    advanceTimers(700)

    expect(screen.getByText('Photos from trips')).toBeInTheDocument()
  })

  it('never opens while disabled', () => {
    mockTagDescriptions = new Map([['vacation', 'Photos from trips']])
    render(
      <MantineProvider>
        <TargetHarness tag="vacation" disabled />
      </MantineProvider>
    )

    fireEvent.mouseEnter(screen.getByRole('button', { name: '#vacation' }))
    advanceTimers(700)

    expect(screen.queryByText('Photos from trips')).not.toBeInTheDocument()
  })
})

describe('TagHoverCardBody', () => {
  it('shows the tag name, description, and photo/view counts', () => {
    render(
      <MantineProvider>
        <TagHoverCardBody
          tag="vacation"
          description="Photos from trips"
          photoCount={12}
          viewCount={47}
        />
      </MantineProvider>
    )

    expect(screen.getByText('#vacation')).toBeInTheDocument()
    expect(screen.getByText('Photos from trips')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()
  })

  it('renders the cover photo when it has a ready thumbnail', () => {
    render(
      <MantineProvider>
        <TagHoverCardBody tag="vacation" coverPhoto={makePhoto()} photoCount={1} viewCount={0} />
      </MantineProvider>
    )

    expect(screen.getByRole('img', { name: 'beach.jpg' })).toBeInTheDocument()
  })

  it('does not render a cover image when the photo has no ready thumbnail', () => {
    render(
      <MantineProvider>
        <TagHoverCardBody
          tag="vacation"
          coverPhoto={makePhoto({ thumbnailStatus: 'pending', thumbnailKey: null })}
          photoCount={1}
          viewCount={0}
        />
      </MantineProvider>
    )

    expect(screen.queryByRole('img', { name: 'beach.jpg' })).not.toBeInTheDocument()
  })

  it('does not render a cover image when there is no cover photo at all', () => {
    render(
      <MantineProvider>
        <TagHoverCardBody tag="vacation" photoCount={0} viewCount={0} />
      </MantineProvider>
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
