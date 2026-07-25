import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('calls onConfirm/onCancel when their buttons are clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <MantineProvider>
        <ConfirmDialog
          title="Delete tag?"
          opened
          saving={false}
          confirmLabel="Delete"
          confirmColor="red"
          onConfirm={onConfirm}
          onCancel={onCancel}
        >
          <p>This removes the tag from 5 photos.</p>
        </ConfirmDialog>
      </MantineProvider>
    )

    expect(screen.getByText('Delete tag?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disables Cancel and shows a loading Confirm button while saving', () => {
    render(
      <MantineProvider>
        <ConfirmDialog
          title="Delete tag?"
          opened
          saving
          confirmLabel="Delete"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        >
          content
        </ConfirmDialog>
      </MantineProvider>
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('renders nothing interactive when closed', () => {
    render(
      <MantineProvider>
        <ConfirmDialog
          title="Delete tag?"
          opened={false}
          saving={false}
          confirmLabel="Delete"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        >
          content
        </ConfirmDialog>
      </MantineProvider>
    )
    expect(screen.queryByText('Delete tag?')).not.toBeInTheDocument()
  })
})
