import { render } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { AppLogo } from './AppLogo'

describe('AppLogo', () => {
  it('renders an inline svg', () => {
    const { container } = render(
      <MantineProvider>
        <AppLogo />
      </MantineProvider>
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
