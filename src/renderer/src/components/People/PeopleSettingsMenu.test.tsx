import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const mockSetPeoplePanelGridView = vi.fn()

vi.mock('@state', () => ({
  useSidebarLibrary: () => ({
    state: { peoplePanelGridView: false }
  }),
  useLibraryActions: () => ({
    setPeoplePanelGridView: mockSetPeoplePanelGridView
  })
}))

import { PeopleSettingsMenu } from './PeopleSettingsMenu'

describe('PeopleSettingsMenu', () => {
  it('toggles grid view from the settings menu', async () => {
    const user = userEvent.setup()
    render(
      <MantineProvider>
        <PeopleSettingsMenu />
      </MantineProvider>
    )

    await user.click(screen.getByRole('button', { name: 'People settings' }))
    await user.click(await screen.findByText('Grid view'))

    expect(mockSetPeoplePanelGridView).toHaveBeenCalledExactlyOnceWith(true)
  })
})
