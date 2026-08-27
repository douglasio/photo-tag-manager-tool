import type { BrowserWindow } from 'electron'

import { setWindowState } from '@main/db/settingsRepository'
import type { WindowState } from '@shared/types'

// Matches mainWindow.setMinimumSize() in index.ts — a restored size is
// clamped up to this, so a state saved before the minimum existed (or on a
// larger display) can't reopen unusably small.
export const MIN_WINDOW_WIDTH = 1100
export const MIN_WINDOW_HEIGHT = 780

// Fraction of the primary display used when there's nothing saved yet.
const DEFAULT_SCREEN_FRACTION = 0.8

// How much of the window must overlap a display for its saved position to be
// reusable. Enough to leave the titlebar grabbable — a window restored with
// only a few pixels on screen is effectively lost, which is the failure mode
// that makes naive window-state restore worse than not restoring at all.
const MIN_VISIBLE_WIDTH = 120
const MIN_VISIBLE_HEIGHT = 60

// Coalesces the burst of resize/move events a single drag emits into one
// write, so dragging a window doesn't hammer SQLite.
const SAVE_DEBOUNCE_MS = 400

export interface DisplayArea {
  x: number
  y: number
  width: number
  height: number
}

// `center: true` and explicit x/y are mutually exclusive: we either restore a
// verified position or hand placement back to Electron, never both.
export interface ResolvedWindowBounds {
  width: number
  height: number
  x?: number
  y?: number
  center?: true
  maximized: boolean
}

function overlaps(rect: WindowState, area: DisplayArea): boolean {
  const overlapWidth = Math.min(rect.x + rect.width, area.x + area.width) - Math.max(rect.x, area.x)
  const overlapHeight =
    Math.min(rect.y + rect.height, area.y + area.height) - Math.max(rect.y, area.y)
  return overlapWidth >= MIN_VISIBLE_WIDTH && overlapHeight >= MIN_VISIBLE_HEIGHT
}

// Pure so the display-geometry edge cases (unplugged monitor, a display that
// shrank, a window saved larger than any current screen) are testable without
// an Electron window.
export function resolveWindowBounds(
  saved: WindowState | null,
  primaryWorkArea: DisplayArea,
  displayWorkAreas: DisplayArea[]
): ResolvedWindowBounds {
  const defaults: ResolvedWindowBounds = {
    width: Math.max(MIN_WINDOW_WIDTH, Math.round(primaryWorkArea.width * DEFAULT_SCREEN_FRACTION)),
    height: Math.max(
      MIN_WINDOW_HEIGHT,
      Math.round(primaryWorkArea.height * DEFAULT_SCREEN_FRACTION)
    ),
    center: true,
    maximized: false
  }
  if (!saved) return defaults

  // Never restore bigger than the display can show, but never below the
  // window's own minimum either — if those conflict (a tiny screen), the
  // minimum wins, since Electron would enforce it anyway.
  const host = displayWorkAreas.find((area) => overlaps(saved, area))
  const bounds = host ?? primaryWorkArea
  const width = Math.max(MIN_WINDOW_WIDTH, Math.min(saved.width, bounds.width))
  const height = Math.max(MIN_WINDOW_HEIGHT, Math.min(saved.height, bounds.height))

  // The saved display is gone (monitor unplugged, resolution reshuffled):
  // keep the remembered size, but let Electron place it on the primary
  // display rather than restoring coordinates pointing into dead space.
  if (!host) return { width, height, center: true, maximized: saved.maximized }

  return { width, height, x: saved.x, y: saved.y, maximized: saved.maximized }
}

// Saves position/size as the user moves and resizes. Uses getNormalBounds()
// rather than getBounds() so a maximized window records the size it will
// return to when unmaximized, not the maximized rect — otherwise restoring
// then unmaximizing would snap to full-screen dimensions.
export function trackWindowState(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null

  const save = (): void => {
    if (window.isDestroyed()) return
    const { x, y, width, height } = window.getNormalBounds()
    setWindowState({ x, y, width, height, maximized: window.isMaximized() })
  }

  const scheduleSave = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, SAVE_DEBOUNCE_MS)
  }

  window.on('resize', scheduleSave)
  window.on('move', scheduleSave)
  window.on('maximize', scheduleSave)
  window.on('unmaximize', scheduleSave)

  // A quit can land inside the debounce window, so flush synchronously on
  // close — otherwise the last drag before quitting is the one change that
  // never gets persisted.
  window.on('close', () => {
    if (timer) clearTimeout(timer)
    save()
  })
}
