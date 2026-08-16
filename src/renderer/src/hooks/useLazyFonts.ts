import { useEffect, useState } from 'react'

// Loads @fontsource stylesheets on first mount and reports when they're ready
// so callers can delay rendering text; keep each specifier literal for Vite's code-splitting.
export function useLazyFonts(loaders: (() => Promise<unknown>)[]): boolean {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all(loaders.map((load) => load())).then(() => {
      if (!cancelled) setLoaded(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately load-once, not on loaders identity
  }, [])

  return loaded
}
