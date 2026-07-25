import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// globals: false in vitest.config.ts, so RTL's own auto-cleanup (which
// relies on detecting a global afterEach) doesn't kick in — wire it up
// explicitly so a component rendered in one test doesn't leak into the next.
afterEach(cleanup)

// Minimal stand-in for the preload-exposed `window.electron`/`window.api` —
// only what's actually read at module-eval time (utils/platform.ts) or by
// components under test needs to be here; individual tests can override
// specific methods with vi.spyOn/vi.stubGlobal as needed.
if (typeof window !== 'undefined' && !window.electron) {
  Object.defineProperty(window, 'electron', {
    value: { process: { platform: 'darwin' } },
    writable: true,
    configurable: true
  })
}

// jsdom doesn't implement matchMedia — Mantine's color-scheme detection and
// useReducedMotion both read it, so any component test using MantineProvider
// (or a hook that calls useReducedMotion) needs this stub.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }) as MediaQueryList
}
