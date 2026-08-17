import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PersonMergeDialog } from './PersonMergeDialog'

describe('PersonMergeDialog', () => {
  it('shows both names and calls onConfirm/onCancel when their buttons are clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <MantineProvider>
        <PersonMergeDialog
          sourceName="Jamie"
          targetName="Alex"
          opened
          saving={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </MantineProvider>
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Jamie')
    expect(dialog.textContent).toContain('Alex')

    await user.click(screen.getByRole('button', { name: 'Merge' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders nothing interactive when closed', () => {
    render(
      <MantineProvider>
        <PersonMergeDialog
          sourceName="Jamie"
          targetName="Alex"
          opened={false}
          saving={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </MantineProvider>
    )
    expect(screen.queryByRole('button', { name: 'Merge' })).not.toBeInTheDocument()
  })
})
