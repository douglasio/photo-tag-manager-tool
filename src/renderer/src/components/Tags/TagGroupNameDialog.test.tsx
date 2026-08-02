import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TagGroupNameDialog } from './TagGroupNameDialog'

function renderDialog(props: Partial<Parameters<typeof TagGroupNameDialog>[0]> = {}): {
  onConfirm: ReturnType<typeof vi.fn>
  onCancel: ReturnType<typeof vi.fn>
} {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <MantineProvider>
      <TagGroupNameDialog
        title="New tag group"
        confirmLabel="Create"
        opened
        saving={false}
        initialName=""
        existingNames={['People', 'Places']}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />
    </MantineProvider>
  )
  return { onConfirm, onCancel }
}

describe('TagGroupNameDialog', () => {
  it('keeps the confirm button disabled until a non-empty, non-duplicate name is entered', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()

    const confirmButton = screen.getByRole('button', { name: 'Create' })
    const input = screen.getByLabelText('Group name')

    expect(confirmButton).toBeDisabled()

    await user.type(input, 'People')
    expect(confirmButton).toBeDisabled()
    expect(screen.getByText('A group with that name already exists')).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'Events')
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)
    expect(onConfirm).toHaveBeenCalledWith('Events')
  })

  it('submits the trimmed name on Enter', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()

    await user.type(screen.getByLabelText('Group name'), '  Events  {Enter}')
    expect(onConfirm).toHaveBeenCalledWith('Events')
  })

  it('prefills with initialName for renaming and excludes it from the duplicate check', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog({
      title: 'Rename tag group',
      confirmLabel: 'Rename',
      initialName: 'People',
      existingNames: ['Places']
    })

    const confirmButton = screen.getByRole('button', { name: 'Rename' })
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)
    expect(onConfirm).toHaveBeenCalledWith('People')
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
