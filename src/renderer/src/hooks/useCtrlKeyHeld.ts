import { useEffect, useState } from 'react'

// Tracked globally (not per-element) since the gallery's Ctrl+hover preview
// needs a single shared answer to "is Ctrl currently down" regardless of
// which thumbnail the cursor is over.
export function useCtrlKeyHeld(): boolean {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Control') setHeld(true)
    }
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.key === 'Control') setHeld(false)
    }
    // Guards against a "stuck" held state if focus leaves the window (e.g.
    // an OS-level app switch) while the key is down, since keyup would then
    // never fire in this window.
    const handleBlur = (): void => setHeld(false)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return held
}
