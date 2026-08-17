import { describe, expect, it } from 'vitest'

import { computeDuplicateGroupSignature } from './duplicateGroupSignature'

describe('computeDuplicateGroupSignature', () => {
  it('is stable regardless of input order', () => {
    expect(computeDuplicateGroupSignature(['/b.jpg', '/a.jpg'])).toBe(
      computeDuplicateGroupSignature(['/a.jpg', '/b.jpg'])
    )
  })

  it('produces distinct signatures for distinct groups', () => {
    expect(computeDuplicateGroupSignature(['/a.jpg', '/b.jpg'])).not.toBe(
      computeDuplicateGroupSignature(['/a.jpg', '/c.jpg'])
    )
  })

  it('does not mutate the input array', () => {
    const filePaths = ['/b.jpg', '/a.jpg']
    computeDuplicateGroupSignature(filePaths)
    expect(filePaths).toEqual(['/b.jpg', '/a.jpg'])
  })
})
