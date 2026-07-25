import { describe, expect, it } from 'vitest'
import { isNullOrEmpty } from './functions'

describe('isNullOrEmpty', () => {
  it('is true for null, undefined, and whitespace-only strings', () => {
    expect(isNullOrEmpty(null)).toBe(true)
    expect(isNullOrEmpty(undefined)).toBe(true)
    expect(isNullOrEmpty('   ')).toBe(true)
    expect(isNullOrEmpty('')).toBe(true)
  })

  it('is false for a non-empty value', () => {
    expect(isNullOrEmpty('hello')).toBe(false)
    expect(isNullOrEmpty(0)).toBe(false)
  })
})
