import { describe, expect, it } from 'vitest'
import { useThumbnailSpotlight } from './useThumbnailSpotlight'

describe('useThumbnailSpotlight', () => {
  it('is idle when disabled, regardless of spotlighted/dimmed', () => {
    expect(useThumbnailSpotlight(false, true, false).animate).toMatchObject({
      scale: 1,
      opacity: 1
    })
    expect(useThumbnailSpotlight(false, false, true).animate).toMatchObject({
      scale: 1,
      opacity: 1
    })
  })

  it('scales up and saturates when spotlighted', () => {
    const { animate } = useThumbnailSpotlight(true, true, false)
    expect(animate.scale).toBeGreaterThan(1)
    expect(animate.opacity).toBe(1)
    expect(animate.filter).toContain('saturate(')
  })

  it('dims and blurs when another thumbnail is spotlighted', () => {
    const { animate } = useThumbnailSpotlight(true, false, true)
    expect(animate.scale).toBe(1)
    expect(animate.opacity).toBeLessThan(1)
    expect(animate.filter).toMatch(/blur\((?!0px\))/)
  })

  it('is idle when neither spotlighted nor dimmed', () => {
    const { animate } = useThumbnailSpotlight(true, false, false)
    expect(animate).toMatchObject({ scale: 1, opacity: 1, filter: 'blur(0px) saturate(1)' })
  })

  it('spotlighted takes precedence over dimmed if somehow both are true', () => {
    const { animate } = useThumbnailSpotlight(true, true, true)
    expect(animate.scale).toBeGreaterThan(1)
  })
})
