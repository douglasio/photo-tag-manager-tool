import { useEffect } from 'react'

import { useLibraryActions } from '@renderer/state/PhotoLibraryActionsContext'
import { useGalleryLibrary } from '@renderer/state/PhotoLibraryGalleryContext'
import { PREVIEW_TRIGGER_KEY } from '@utils'

// True while focus is inside anything a global shortcut below shouldn't hijack a keystroke from.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

// Elements/roles where Space should keep its native behavior, not be swallowed globally below.
const SPACE_ACTIVATABLE_ROLES = new Set([
  'button',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option'
])

function isSpaceActivatable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (isEditableTarget(target)) return true
  if (['BUTTON', 'A', 'SUMMARY'].includes(target.tagName)) return true
  const role = target.getAttribute('role')
  return role !== null && SPACE_ACTIVATABLE_ROLES.has(role)
}

// AppLayout's global keyboard shortcuts: floating-element dismiss, tab-switch, tab-cycle, Space.
export function useAppKeyboardShortcuts(): void {
  const { state } = useGalleryLibrary()
  const { setActiveTab } = useLibraryActions()

  // Mantine's Tooltip only closes on mouseleave, so a click that navigates away can leave it stuck
  // open. Dispatching Escape on every pointerdown closes any open floating element instead.
  useEffect(() => {
    const handlePointerDown = (): void => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  // Universal "jump to gallery" / "jump to dashboard" shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== 'g' && event.key !== 'd') return
      if (isEditableTarget(event.target)) return
      setActiveTab(event.key === 'g' ? 'gallery' : 'dashboard')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setActiveTab])

  // Alt+Left/Right cycles between open tabs
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
      if (isEditableTarget(event.target)) return
      const order = ['dashboard', 'gallery', ...state.openTabs]
      const currentIndex = order.indexOf(state.activeTab)
      if (currentIndex === -1) return
      const nextIndex = event.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1
      if (nextIndex < 0 || nextIndex >= order.length) return
      event.preventDefault()
      setActiveTab(order[nextIndex])
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.openTabs, state.activeTab, setActiveTab])

  // Space's default page-down scroll fights with its job as the preview trigger key.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== PREVIEW_TRIGGER_KEY) return
      if (isSpaceActivatable(event.target)) return
      event.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
