// @vitest-environment node
import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSetWindowState } = vi.hoisted(() => ({ mockSetWindowState: vi.fn() }))
vi.mock('@main/db/settingsRepository', () => ({ setWindowState: mockSetWindowState }))

import type { WindowState } from '@shared/types'

import {
  type DisplayArea,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  resolveWindowBounds,
  trackWindowState
} from './windowStateService'

const PRIMARY: DisplayArea = { x: 0, y: 0, width: 2560, height: 1400 }
const SECONDARY: DisplayArea = { x: 2560, y: 0, width: 1920, height: 1080 }

function savedState(overrides: Partial<WindowState> = {}): WindowState {
  return { x: 100, y: 80, width: 1600, height: 1000, maximized: false, ...overrides }
}

describe('resolveWindowBounds', () => {
  it('falls back to a centered 80% of the primary display when nothing is saved', () => {
    const bounds = resolveWindowBounds(null, PRIMARY, [PRIMARY])

    expect(bounds).toEqual({ width: 2048, height: 1120, center: true, maximized: false })
  })

  it('restores an exact saved position that still lands on a display', () => {
    const bounds = resolveWindowBounds(savedState(), PRIMARY, [PRIMARY, SECONDARY])

    expect(bounds).toEqual({ x: 100, y: 80, width: 1600, height: 1000, maximized: false })
  })

  it('restores a position on a secondary display', () => {
    const saved = savedState({ x: 2700, y: 200 })

    expect(resolveWindowBounds(saved, PRIMARY, [PRIMARY, SECONDARY])).toMatchObject({
      x: 2700,
      y: 200
    })
  })

  it('keeps the size but drops the position when the saved display is gone', () => {
    const saved = savedState({ x: 2700, y: 200 })

    const bounds = resolveWindowBounds(saved, PRIMARY, [PRIMARY])

    expect(bounds).toEqual({ width: 1600, height: 1000, center: true, maximized: false })
  })

  it('drops a position that overlaps a display too marginally to grab', () => {
    // Only 30px of the window remains on screen — technically intersecting,
    // but not enough to reach the titlebar.
    const saved = savedState({ x: PRIMARY.width - 30, y: 100 })

    expect(resolveWindowBounds(saved, PRIMARY, [PRIMARY])).toHaveProperty('center', true)
  })

  it('clamps a saved size larger than its display down to fit', () => {
    const saved = savedState({ x: 2600, y: 10, width: 3000, height: 2000 })

    expect(resolveWindowBounds(saved, PRIMARY, [PRIMARY, SECONDARY])).toMatchObject({
      width: SECONDARY.width,
      height: SECONDARY.height
    })
  })

  it('never restores below the window minimum, even from a smaller saved size', () => {
    const saved = savedState({ width: 400, height: 300 })

    expect(resolveWindowBounds(saved, PRIMARY, [PRIMARY])).toMatchObject({
      width: MIN_WINDOW_WIDTH,
      height: MIN_WINDOW_HEIGHT
    })
  })

  it('keeps the minimum even when the display is smaller than it', () => {
    const tiny: DisplayArea = { x: 0, y: 0, width: 800, height: 600 }
    const saved = savedState({ x: 0, y: 0, width: 1600, height: 1000 })

    expect(resolveWindowBounds(saved, tiny, [tiny])).toMatchObject({
      width: MIN_WINDOW_WIDTH,
      height: MIN_WINDOW_HEIGHT
    })
  })

  it('carries the maximized flag through', () => {
    const saved = savedState({ maximized: true })

    expect(resolveWindowBounds(saved, PRIMARY, [PRIMARY])).toHaveProperty('maximized', true)
  })
})

// Mimics just enough of BrowserWindow for the listener/debounce logic: an
// event map the test can fire by hand, plus the two geometry accessors.
function createFakeWindow(): {
  window: BrowserWindow
  emit: (event: string) => void
  setMaximized: (value: boolean) => void
} {
  const listeners = new Map<string, (() => void)[]>()
  let maximized = false
  const window = {
    on: (event: string, listener: () => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener])
    },
    isDestroyed: () => false,
    isMaximized: () => maximized,
    getNormalBounds: () => ({ x: 12, y: 34, width: 1600, height: 1000 })
  } as unknown as BrowserWindow

  return {
    window,
    emit: (event) => listeners.get(event)?.forEach((listener) => listener()),
    setMaximized: (value) => {
      maximized = value
    }
  }
}

describe('trackWindowState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockSetWindowState.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces a burst of move/resize events into a single write', () => {
    const { window, emit } = createFakeWindow()
    trackWindowState(window)

    for (let i = 0; i < 20; i++) emit('resize')
    emit('move')
    expect(mockSetWindowState).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(mockSetWindowState).toHaveBeenCalledTimes(1)
    expect(mockSetWindowState).toHaveBeenCalledWith({
      x: 12,
      y: 34,
      width: 1600,
      height: 1000,
      maximized: false
    })
  })

  it('flushes synchronously on close, so a quit mid-debounce still persists', () => {
    const { window, emit } = createFakeWindow()
    trackWindowState(window)

    emit('move')
    emit('close')

    // Written without needing the timer, and only once — the pending debounce
    // must have been cancelled rather than firing a second write.
    expect(mockSetWindowState).toHaveBeenCalledTimes(1)
    vi.runAllTimers()
    expect(mockSetWindowState).toHaveBeenCalledTimes(1)
  })

  it('records the pre-maximize size alongside the maximized flag', () => {
    const { window, emit, setMaximized } = createFakeWindow()
    trackWindowState(window)

    setMaximized(true)
    emit('maximize')
    vi.runAllTimers()

    expect(mockSetWindowState).toHaveBeenCalledWith({
      x: 12,
      y: 34,
      width: 1600,
      height: 1000,
      maximized: true
    })
  })
})
