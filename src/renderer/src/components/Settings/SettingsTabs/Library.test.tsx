import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DataSection } from './Library'

let mockApi: Record<string, ReturnType<typeof vi.fn>>

function renderSection(): ReturnType<typeof render> {
  return render(
    <MantineProvider>
      <DataSection />
    </MantineProvider>
  )
}

describe('DataSection', () => {
  beforeEach(() => {
    mockApi = {
      exportDatabase: vi.fn().mockResolvedValue(true),
      importDatabase: vi.fn().mockResolvedValue(undefined),
      clearLibrary: vi.fn().mockResolvedValue(undefined)
    }
    vi.stubGlobal('window', Object.assign(window, { api: mockApi }))
  })

  it('exports the database directly, with no confirmation dialog', async () => {
    const user = userEvent.setup()
    renderSection()

    await user.click(screen.getByRole('button', { name: 'Export Database' }))

    await waitFor(() => expect(mockApi.exportDatabase).toHaveBeenCalled())
  })

  it('does not import until the confirmation dialog is confirmed', async () => {
    const user = userEvent.setup()
    renderSection()

    await user.click(screen.getByRole('button', { name: 'Import Database…' }))
    expect(mockApi.importDatabase).not.toHaveBeenCalled()

    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(mockApi.importDatabase).toHaveBeenCalled())
  })

  it('shows a rejected import as an inline error instead of closing the dialog', async () => {
    mockApi.importDatabase.mockRejectedValue(
      new Error("That file doesn't look like a Tag Me database.")
    )
    const user = userEvent.setup()
    renderSection()

    await user.click(screen.getByRole('button', { name: 'Import Database…' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Import' }))

    expect(
      await dialog.findByText("That file doesn't look like a Tag Me database.")
    ).toBeInTheDocument()
  })

  it('does not clear the library until the confirmation dialog is confirmed', async () => {
    const user = userEvent.setup()
    renderSection()

    await user.click(screen.getByRole('button', { name: 'Clear Library' }))
    expect(mockApi.clearLibrary).not.toHaveBeenCalled()

    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Clear Library' }))

    await waitFor(() => expect(mockApi.clearLibrary).toHaveBeenCalled())
  })
})
