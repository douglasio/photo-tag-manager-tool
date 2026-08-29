import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SectionTitle } from './SectionTitle'

/** Inline style of a rendered title, unmounting so each call starts clean. */
function styleOf(sub: boolean): string {
  const { unmount } = render(
    <MantineProvider>
      <SectionTitle sub={sub}>Suggested</SectionTitle>
    </MantineProvider>
  )
  const style = screen.getByText('Suggested').getAttribute('style') ?? ''
  unmount()
  return style
}

describe('SectionTitle', () => {
  it('renders a heading at the shared section level either way', () => {
    render(
      <MantineProvider>
        <SectionTitle>Tags</SectionTitle>
      </MantineProvider>
    )
    expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument()
  })

  // The sub variant is what makes "Suggested" read as nested inside "Tags"
  // rather than as a sibling section of it: it overrides the shared h6 sizing
  // with an explicit smaller font-size, which the default deliberately leaves alone.
  it('renders the sub variant a step smaller than the default', () => {
    expect(styleOf(false)).not.toContain('font-size:')
    expect(styleOf(true)).toContain('font-size: var(--mantine-font-size-xs)')
  })
})
