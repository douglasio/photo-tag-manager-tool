import { describe, expect, it } from 'vitest'

import { isUnderExcludedFolder } from './folderExclusion'

describe('isUnderExcludedFolder', () => {
  it('is false when there are no excluded folders', () => {
    expect(isUnderExcludedFolder('/root/test/a.jpg', [])).toBe(false)
  })

  it('is true for a photo directly inside an excluded folder', () => {
    expect(isUnderExcludedFolder('/root/test/a.jpg', ['/root/test'])).toBe(true)
  })

  it('is true for a photo nested in a subfolder of an excluded folder', () => {
    expect(isUnderExcludedFolder('/root/test/nested/a.jpg', ['/root/test'])).toBe(true)
  })

  it('is false for a photo in a sibling folder with a matching prefix', () => {
    expect(isUnderExcludedFolder('/root/test-other/a.jpg', ['/root/test'])).toBe(false)
  })

  it('is false for a photo outside every excluded folder', () => {
    expect(isUnderExcludedFolder('/root/other/a.jpg', ['/root/test'])).toBe(false)
  })

  it('checks every excluded folder in the list', () => {
    expect(isUnderExcludedFolder('/root/b/a.jpg', ['/root/a', '/root/b'])).toBe(true)
  })
})
