import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const mockSetActiveTab = vi.fn()

vi.mock('@state', () => ({
  usePhotoLibrary: () => ({
    setActiveTab: mockSetActiveTab
  })
}))

// The greeting's own hour-boundary logic is covered by greeting.test.ts —
// this just confirms the widget renders whatever it returns. Keeps every
// other @utils export real (e.g. ACTION_ICONS) rather than needing to
// hand-mock them too.
vi.mock('@utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@utils')>()),
  getGreeting: () => 'Good afternoon'
}))

import { WelcomeWidget } from './WelcomeWidget'

function renderWidget(): void {
  render(
    <MantineProvider>
      <WelcomeWidget />
    </MantineProvider>
  )
}

describe('WelcomeWidget', () => {
  it('renders the greeting', () => {
    renderWidget()
    expect(screen.getByRole('heading', { name: 'Good afternoon' })).toBeInTheDocument()
  })

  it('renders a "Go to Gallery" button', () => {
    renderWidget()
    expect(screen.getByRole('button', { name: /Go to Gallery/ })).toBeInTheDocument()
  })

  it('switches to the gallery tab when clicked', async () => {
    const user = userEvent.setup()
    renderWidget()

    await user.click(screen.getByRole('button', { name: /Go to Gallery/ }))

    expect(mockSetActiveTab).toHaveBeenCalledExactlyOnceWith('gallery')
  })
})
