import { describe, expect, it } from 'vitest'

import { activeHoverBackground } from './listItemStyles'

describe('activeHoverBackground', () => {
  it('uses the active-hover color when active and hovered', () => {
    expect(activeHoverBackground(true, true)).toBe('var(--mantine-primary-color-light-hover)')
  })

  it('uses the plain active color when active but not hovered', () => {
    expect(activeHoverBackground(true, false)).toBe('var(--mantine-primary-color-light)')
  })

  it('uses the default hover color when hovered but not active', () => {
    expect(activeHoverBackground(false, true)).toBe('var(--mantine-color-default-hover)')
  })

  it('is undefined when neither active nor hovered', () => {
    expect(activeHoverBackground(false, false)).toBeUndefined()
  })
})
