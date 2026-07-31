import { describe, expect, it } from 'vitest'

import { toFileProtocolUrl, toThumbProtocolUrl } from './protocolUrls'

describe('toThumbProtocolUrl', () => {
  it('builds a photag-thumb URL from the thumbnail key', () => {
    expect(toThumbProtocolUrl('abc123')).toBe('photag-thumb://abc123')
  })
})

describe('toFileProtocolUrl', () => {
  it('builds a photag-file URL with the path encoded', () => {
    expect(toFileProtocolUrl('/root/a b.jpg')).toBe('photag-file://local/%2Froot%2Fa%20b.jpg')
  })

  it('appends an encoded cache-bust query param when given one', () => {
    expect(toFileProtocolUrl('/root/a.jpg', 'v1 key')).toBe(
      'photag-file://local/%2Froot%2Fa.jpg?v=v1%20key'
    )
  })

  it('omits the query param for a null/undefined/empty cache-bust', () => {
    expect(toFileProtocolUrl('/root/a.jpg', null)).toBe('photag-file://local/%2Froot%2Fa.jpg')
    expect(toFileProtocolUrl('/root/a.jpg', undefined)).toBe('photag-file://local/%2Froot%2Fa.jpg')
    expect(toFileProtocolUrl('/root/a.jpg', '')).toBe('photag-file://local/%2Froot%2Fa.jpg')
  })
})
