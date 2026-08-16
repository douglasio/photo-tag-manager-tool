import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

let mockInitialLoadComplete = false

vi.mock('./state/PhotoLibraryGalleryContext', () => ({
  useGalleryLibrary: () => ({ state: { initialLoadComplete: mockInitialLoadComplete } })
}))
vi.mock('@components', () => ({
  AppLayout: () => <div>AppLayout</div>,
  StartupLoadingScreen: () => <div>StartupLoadingScreen</div>
}))

import { AppGate } from './App'

describe('AppGate', () => {
  it('shows the loading screen until the initial scan completes', () => {
    mockInitialLoadComplete = false
    render(<AppGate />)
    expect(screen.getByText('StartupLoadingScreen')).toBeInTheDocument()
    expect(screen.queryByText('AppLayout')).not.toBeInTheDocument()
  })

  it('shows AppLayout once the initial scan completes', () => {
    mockInitialLoadComplete = true
    render(<AppGate />)
    expect(screen.getByText('AppLayout')).toBeInTheDocument()
    expect(screen.queryByText('StartupLoadingScreen')).not.toBeInTheDocument()
  })
})
