import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PersonContextMenu } from './PersonContextMenu'

describe('PersonContextMenu', () => {
  it('opens on right-click and calls onRename/onHide/onDelete', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    const onHide = vi.fn()
    const onDelete = vi.fn()

    render(
      <MantineProvider>
        <PersonContextMenu onRename={onRename} onHide={onHide} onDelete={onDelete}>
          <button type="button">Jamie</button>
        </PersonContextMenu>
      </MantineProvider>
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Jamie' }))
    await user.click(await screen.findByText('Rename'))
    expect(onRename).toHaveBeenCalledTimes(1)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Jamie' }))
    await user.click(await screen.findByText('Hide'))
    expect(onHide).toHaveBeenCalledTimes(1)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Jamie' }))
    await user.click(await screen.findByText('Delete'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
