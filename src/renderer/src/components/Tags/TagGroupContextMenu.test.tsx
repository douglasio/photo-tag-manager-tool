import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TagGroupContextMenu } from './TagGroupContextMenu'

describe('TagGroupContextMenu', () => {
  it('opens on right-click and calls onRename/onEditPattern/onDelete', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    const onEditPattern = vi.fn()
    const onDelete = vi.fn()

    render(
      <MantineProvider>
        <TagGroupContextMenu onRename={onRename} onEditPattern={onEditPattern} onDelete={onDelete}>
          <button type="button">People</button>
        </TagGroupContextMenu>
      </MantineProvider>
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: 'People' }))
    await user.click(await screen.findByText('Rename'))
    expect(onRename).toHaveBeenCalledTimes(1)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'People' }))
    await user.click(await screen.findByText('Edit auto-add rule'))
    expect(onEditPattern).toHaveBeenCalledTimes(1)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'People' }))
    await user.click(await screen.findByText('Delete'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('also opens the same menu by clicking the cog button', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()

    render(
      <MantineProvider>
        <TagGroupContextMenu onRename={onRename} onEditPattern={vi.fn()} onDelete={vi.fn()}>
          <button type="button">People</button>
        </TagGroupContextMenu>
      </MantineProvider>
    )

    await user.click(screen.getByRole('button', { name: 'Group options' }))
    await user.click(await screen.findByText('Rename'))
    expect(onRename).toHaveBeenCalledTimes(1)
  })
})
