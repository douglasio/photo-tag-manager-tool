import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FolderBadge } from './FolderBadge'

describe('FolderBadge', () => {
  it('renders filled when active', () => {
    render(
      <MantineProvider>
        <FolderBadge isActive>3</FolderBadge>
      </MantineProvider>
    )
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders light when inactive', () => {
    render(
      <MantineProvider>
        <FolderBadge isActive={false}>3</FolderBadge>
      </MantineProvider>
    )
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
