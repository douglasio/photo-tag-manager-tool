// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { matchesExcludePattern } from './excludeMatcher'

describe('matchesExcludePattern', () => {
  it('is false when there are no patterns', () => {
    expect(matchesExcludePattern('/root/a.jpg', [])).toBe(false)
  })

  it('matches a case-insensitive substring anywhere in the path', () => {
    expect(matchesExcludePattern('/root/.PicasaOriginals/a.jpg', ['.picasaoriginals'])).toBe(true)
  })

  it('is false when no pattern matches', () => {
    expect(matchesExcludePattern('/root/a.jpg', ['thumbs'])).toBe(false)
  })

  it('ignores blank patterns rather than matching everything', () => {
    expect(matchesExcludePattern('/root/a.jpg', ['   '])).toBe(false)
  })
})
