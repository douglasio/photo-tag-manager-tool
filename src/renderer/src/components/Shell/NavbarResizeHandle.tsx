import { type PointerEvent as ReactPointerEvent, type ReactElement, useRef, useState } from 'react'

import { Box, rem } from '@mantine/core'
import { useHover, useMergedRef } from '@mantine/hooks'

import {
  clampNavbarWidth,
  DEFAULT_NAVBAR_WIDTH,
  MAX_NAVBAR_WIDTH,
  MIN_NAVBAR_WIDTH,
  useLibraryActions,
  useSidebarLibrary
} from '@state'

const HANDLE_WIDTH = 5
// One arrow press — coarse enough to cross the range in a sane number of
// presses, fine enough to land on a specific width.
const KEYBOARD_STEP = 16

// AppShell sections are position: fixed, so the sidebar's width can't come
// from a flex/Splitter parent — it flows from the `navbar={{ width }}` prop
// into this CSS variable. Setting it inline during a drag resizes live at
// pointer speed without re-rendering the shell every frame; the commit to
// React state (and persistence) happens once on release, mirroring
// NavbarSplitter's own deferred commit.
//
// Critical: Mantine publishes this variable from a generated `:root{...}`
// style tag, not an inline style, so the inline value written below
// outranks it and would otherwise pin the sidebar at the last dragged width
// forever — every later state change (reset, keyboard nudge, a reload's
// restored value) would be silently ignored. endDrag must therefore remove
// the inline override and hand control back to Mantine.
const APP_SHELL_ROOT_SELECTOR = '.mantine-AppShell-root'
const NAVBAR_WIDTH_VAR = '--app-shell-navbar-width'

export function NavbarResizeHandle(): ReactElement {
  const { state } = useSidebarLibrary()
  const { setNavbarWidth } = useLibraryActions()
  const { hovered, ref: hoverRef } = useHover<HTMLDivElement>()
  const elementRef = useRef<HTMLDivElement>(null)
  const ref = useMergedRef(hoverRef, elementRef)
  // The ref is authoritative for the drag logic; the state exists only to
  // drive the highlight. Gating the move handler on state would drop any
  // pointermove that lands before React has re-rendered from pointerdown.
  const [dragging, setDragging] = useState(false)
  const drag = useRef({ active: false, startX: 0, startWidth: 0, width: 0 })

  const appShellRoot = (): HTMLElement | null => {
    const root = elementRef.current?.closest(APP_SHELL_ROOT_SELECTOR)
    return root instanceof HTMLElement ? root : null
  }

  // rem() matches the unit AppShell itself writes, so releasing the drag
  // lands on exactly the width the drag was already showing.
  const setLiveWidth = (width: number): void => {
    appShellRoot()?.style.setProperty(NAVBAR_WIDTH_VAR, rem(width))
  }

  const clearLiveWidth = (): void => {
    appShellRoot()?.style.removeProperty(NAVBAR_WIDTH_VAR)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    // Stops the drag from starting a text selection in the panels behind it.
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      active: true,
      startX: event.clientX,
      startWidth: state.navbarWidth,
      width: state.navbarWidth
    }
    setDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag.current.active) return
    const next = clampNavbarWidth(drag.current.startWidth + (event.clientX - drag.current.startX))
    drag.current.width = next
    setLiveWidth(next)
  }

  const endDrag = (): void => {
    if (!drag.current.active) return
    drag.current.active = false
    setDragging(false)
    // Commit first, then drop the override: React flushes this discrete
    // event's update before the next paint, so Mantine's own value is
    // already the new one by the time anything is drawn — no flash back to
    // the pre-drag width in between.
    setNavbarWidth(drag.current.width)
    clearLiveWidth()
  }

  const nudge = (delta: number): void => setNavbarWidth(clampNavbarWidth(state.navbarWidth + delta))

  const active = dragging || hovered

  return (
    <Box
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={state.navbarWidth}
      aria-valuemin={MIN_NAVBAR_WIDTH}
      aria-valuemax={MAX_NAVBAR_WIDTH}
      tabIndex={0}
      pos="absolute"
      top={0}
      bottom={0}
      right={0}
      w={HANDLE_WIDTH}
      bg={active ? 'var(--mantine-primary-color-filled)' : 'transparent'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // Restores the width most libraries would call "default" — the same
      // affordance a double-clicked window divider gives.
      onDoubleClick={() => setNavbarWidth(DEFAULT_NAVBAR_WIDTH)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          nudge(-KEYBOARD_STEP)
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          nudge(KEYBOARD_STEP)
        }
      }}
      style={{
        cursor: 'col-resize',
        // Pointer events (not touch scrolling) own this element's gestures.
        touchAction: 'none',
        userSelect: 'none',
        zIndex: 2,
        transition: dragging ? undefined : 'background-color 150ms ease'
      }}
    />
  )
}
