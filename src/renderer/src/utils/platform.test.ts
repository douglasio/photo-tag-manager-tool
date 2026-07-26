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

  it('detects darwin as Mac', async () => {
    stubPlatform('darwin')
    const { isMac } = await import('./platform')
    expect(isMac).toBe(true)
  })

  it('does not detect other platforms as Mac', async () => {
    vi.resetModules()
    stubPlatform('win32')
    const { isMac } = await import('./platform')
    expect(isMac).toBe(false)
  })
})
