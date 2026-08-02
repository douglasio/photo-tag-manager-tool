import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TagGroupPatternDialog } from './TagGroupPatternDialog'

function renderDialog(props: Partial<Parameters<typeof TagGroupPatternDialog>[0]> = {}): {
  onConfirm: ReturnType<typeof vi.fn>
  onCancel: ReturnType<typeof vi.fn>
  rerender: (props: Partial<Parameters<typeof TagGroupPatternDialog>[0]>) => void
} {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const baseProps: Parameters<typeof TagGroupPatternDialog>[0] = {
    opened: true,
    saving: false,
    initialMatchPattern: null,
    onConfirm,
    onCancel,
    ...props
  }
  const { rerender: rtlRerender } = render(
    <MantineProvider>
      <TagGroupPatternDialog {...baseProps} />
    </MantineProvider>
  )
  const rerender = (next: Partial<Parameters<typeof TagGroupPatternDialog>[0]>): void => {
    rtlRerender(
      <MantineProvider>
        <TagGroupPatternDialog {...baseProps} {...next} />
      </MantineProvider>
    )
  }
  return { onConfirm, onCancel, rerender }
}

describe('TagGroupPatternDialog', () => {
  it('prefills the pattern and submits the trimmed value', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog({ initialMatchPattern: 'age' })

    const input = screen.getByLabelText('Auto-add tags containing')
    expect(input).toHaveValue('age')

    await user.clear(input)
    await user.type(input, '  vintage  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfirm).toHaveBeenCalledWith('vintage')
  })

  it('submits null when cleared entirely', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog({ initialMatchPattern: 'age' })

    await user.clear(screen.getByLabelText('Auto-add tags containing'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it('submits on Enter', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()

    await user.type(screen.getByLabelText('Auto-add tags containing'), 'family{Enter}')
    expect(onConfirm).toHaveBeenCalledWith('family')
  })

  it('resets the draft when reopened for a different group', async () => {
    const { rerender } = renderDialog({ opened: false, initialMatchPattern: 'age' })

    rerender({ opened: true, initialMatchPattern: 'city' })

    expect(await screen.findByLabelText('Auto-add tags containing')).toHaveValue('city')
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
