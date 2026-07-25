import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { PanelSection } from './PanelSection'

function withProvider(ui: React.ReactElement): React.ReactElement {
  return <MantineProvider>{ui}</MantineProvider>
}

describe('PanelSection', () => {
  it('renders the title, header action, and children', () => {
    render(
      withProvider(
        <PanelSection title="Folders" headerAction={<button>Add</button>}>
          <div>content</div>
        </PanelSection>
      )
    )
    expect(screen.getByText('Folders')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('renders without a header action', () => {
    render(withProvider(<PanelSection title="Tags">content</PanelSection>))
    expect(screen.getByText('Tags')).toBeInTheDocument()
  })
})
