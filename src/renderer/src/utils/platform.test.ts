import { afterEach, describe, expect, it, vi } from 'vitest'

function stubPlatform(platform: string): void {
  Object.defineProperty(window, 'electron', {
    value: { process: { platform } },
    writable: true,
    configurable: true
  })
}

describe('platform', () => {
  afterEach(() => {
    vi.resetModules()
    stubPlatform('darwin')
  })

  it('labels the Ctrl key with the Mac glyph on darwin', async () => {
    stubPlatform('darwin')
    const { isMac, ctrlKeyLabel } = await import('./platform')
    expect(isMac).toBe(true)
    expect(ctrlKeyLabel).toBe('Ctrl (⌃)')
  })

  it('uses a plain "Ctrl" label on non-Mac platforms', async () => {
    vi.resetModules()
    stubPlatform('win32')
    const { isMac, ctrlKeyLabel } = await import('./platform')
    expect(isMac).toBe(false)
    expect(ctrlKeyLabel).toBe('Ctrl')
  })
})
