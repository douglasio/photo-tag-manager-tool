import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { InlineEditField } from './InlineEditField'

describe('InlineEditField', () => {
  it('calls onStartEdit on double-click of the content when not editing', async () => {
    const user = userEvent.setup()
    const onStartEdit = vi.fn()
    render(
      <MantineProvider>
        <InlineEditField editing={false} onStartEdit={onStartEdit}>
          <span>Display value</span>
        </InlineEditField>
      </MantineProvider>
    )

    await user.dblClick(screen.getByText('Display value'))
    expect(onStartEdit).toHaveBeenCalledTimes(1)
  })

  it('does not call onStartEdit on double-click while already editing', async () => {
    const user = userEvent.setup()
    const onStartEdit = vi.fn()
    render(
      <MantineProvider>
        <InlineEditField editing onStartEdit={onStartEdit}>
          <input defaultValue="editing" />
        </InlineEditField>
      </MantineProvider>
    )
    await user.dblClick(screen.getByDisplayValue('editing'))
    expect(onStartEdit).not.toHaveBeenCalled()
  })

  it('hides the pencil button while editing', () => {
    render(
      <MantineProvider>
        <InlineEditField editing onStartEdit={vi.fn()}>
          <input defaultValue="editing" />
        </InlineEditField>
      </MantineProvider>
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('clicking the pencil button starts editing', async () => {
    const user = userEvent.setup()
    const onStartEdit = vi.fn()
    render(
      <MantineProvider>
        <InlineEditField editing={false} onStartEdit={onStartEdit}>
          <span>Display value</span>
        </InlineEditField>
      </MantineProvider>
    )
    await user.click(screen.getByRole('button'))
    expect(onStartEdit).toHaveBeenCalledTimes(1)
  })
})
