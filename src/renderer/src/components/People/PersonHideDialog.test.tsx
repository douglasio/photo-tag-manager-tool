import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PersonHideDialog } from './PersonHideDialog'

describe('PersonHideDialog', () => {
  it('shows the person name and calls onConfirm/onCancel when their buttons are clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <MantineProvider>
        <PersonHideDialog
          name="Jamie"
          opened
          saving={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </MantineProvider>
    )

    expect(screen.getByText('Jamie')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders nothing interactive when closed', () => {
    render(
      <MantineProvider>
        <PersonHideDialog
          name="Jamie"
          opened={false}
          saving={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </MantineProvider>
    )
    expect(screen.queryByText('Jamie')).not.toBeInTheDocument()
  })
})
