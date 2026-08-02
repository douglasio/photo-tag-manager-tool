import { describe, expect, it } from 'vitest'

import { pickRandom, shuffle } from './random'

describe('shuffle', () => {
  it('returns a new array with the same elements', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffle(input)
    expect(result).not.toBe(input)
    expect(result.slice().sort()).toEqual(input.slice().sort())
  })

  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5]
    const copy = [...input]
    shuffle(input)
    expect(input).toEqual(copy)
  })

  it('handles empty and single-element arrays', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle([1])).toEqual([1])
  })
})

describe('pickRandom', () => {
  it('returns an element from the array', () => {
    const input = ['a', 'b', 'c']
    expect(input).toContain(pickRandom(input))
  })

  it('returns the only element from a single-element array', () => {
    expect(pickRandom(['only'])).toBe('only')
  })
})
