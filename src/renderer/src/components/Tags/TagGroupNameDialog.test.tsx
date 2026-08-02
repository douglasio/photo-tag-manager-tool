import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TagGroupNameDialog } from './TagGroupNameDialog'

function renderDialog(props: Partial<Parameters<typeof TagGroupNameDialog>[0]> = {}): {
  onConfirm: ReturnType<typeof vi.fn>
  onCancel: ReturnType<typeof vi.fn>
  rerender: (props: Partial<Parameters<typeof TagGroupNameDialog>[0]>) => void
} {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const baseProps: Parameters<typeof TagGroupNameDialog>[0] = {
    title: 'New tag group',
    confirmLabel: 'Create',
    opened: true,
    saving: false,
    initialName: '',
    initialMatchPattern: null,
    existingNames: ['People', 'Places'],
    onConfirm,
    onCancel,
    ...props
  }
  const { rerender: rtlRerender } = render(
    <MantineProvider>
      <TagGroupNameDialog {...baseProps} />
    </MantineProvider>
  )
  const rerender = (next: Partial<Parameters<typeof TagGroupNameDialog>[0]>): void => {
    rtlRerender(
      <MantineProvider>
        <TagGroupNameDialog {...baseProps} {...next} />
      </MantineProvider>
    )
  }
  return { onConfirm, onCancel, rerender }
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
    expect(onConfirm).toHaveBeenCalledWith('Events', null)
  })

  it('submits the trimmed name on Enter', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()

    await user.type(screen.getByLabelText('Group name'), '  Events  {Enter}')
    expect(onConfirm).toHaveBeenCalledWith('Events', null)
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
    expect(onConfirm).toHaveBeenCalledWith('People', null)
  })

  it('prefills the match pattern and includes an edited one in onConfirm', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog({
      title: 'Rename tag group',
      confirmLabel: 'Rename',
      initialName: 'People',
      initialMatchPattern: 'family',
      existingNames: ['Places']
    })

    const patternInput = screen.getByLabelText('Auto-add tags containing')
    expect(patternInput).toHaveValue('family')

    await user.clear(patternInput)
    await user.type(patternInput, 'friend')
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    expect(onConfirm).toHaveBeenCalledWith('People', 'friend')
  })

  it('submits on Enter from the auto-add pattern field too', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()

    await user.type(screen.getByLabelText('Group name'), 'Events')
    await user.type(screen.getByLabelText('Auto-add tags containing'), 'party{Enter}')

    expect(onConfirm).toHaveBeenCalledWith('Events', 'party')
  })

  it('resets both drafts when reopened for a different group', async () => {
    const { rerender } = renderDialog({
      opened: false,
      initialName: 'People',
      initialMatchPattern: 'family'
    })

    rerender({ opened: true, initialName: 'Places', initialMatchPattern: 'city' })

    expect(await screen.findByLabelText('Group name')).toHaveValue('Places')
    expect(screen.getByLabelText('Auto-add tags containing')).toHaveValue('city')
  })

  it('hides the auto-add pattern field entirely when initialMatchPattern is omitted', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog({
      title: 'Rename tag group',
      confirmLabel: 'Rename',
      initialName: 'People',
      initialMatchPattern: undefined,
      existingNames: ['Places']
    })

    expect(screen.queryByLabelText('Auto-add tags containing')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Rename' }))
    expect(onConfirm).toHaveBeenCalledWith('People', null)
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
