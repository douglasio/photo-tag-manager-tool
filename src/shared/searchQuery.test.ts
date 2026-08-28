import { describe, expect, it } from 'vitest'

import {
  isEmptyQuery,
  parseSearchQuery,
  type Predicate,
  serializeSearchQuery,
  togglePredicate
} from './searchQuery'

function predicates(input: string): Predicate[] {
  return parseSearchQuery(input).predicates
}

describe('bare terms', () => {
  it('splits on whitespace into free-text predicates', () => {
    expect(predicates('beach sunset')).toEqual([
      { kind: 'text', field: 'any', value: 'beach', negated: false },
      { kind: 'text', field: 'any', value: 'sunset', negated: false }
    ])
  })

  it('treats an empty or whitespace-only query as no predicates', () => {
    expect(isEmptyQuery(parseSearchQuery(''))).toBe(true)
    expect(isEmptyQuery(parseSearchQuery('   '))).toBe(true)
  })

  it('keeps a quoted phrase as one predicate', () => {
    expect(predicates('"family trip"')).toEqual([
      { kind: 'text', field: 'any', value: 'family trip', negated: false }
    ])
  })

  it('supports single quotes, so an apostrophe-free phrase still groups', () => {
    expect(predicates("'family trip'")).toEqual([
      { kind: 'text', field: 'any', value: 'family trip', negated: false }
    ])
  })
})

describe('text flags', () => {
  it('parses each text flag and its aliases', () => {
    expect(predicates('filename:IMG comment:beach folder:2024')).toEqual([
      { kind: 'text', field: 'filename', value: 'IMG', negated: false },
      { kind: 'text', field: 'comment', value: 'beach', negated: false },
      { kind: 'text', field: 'folder', value: '2024', negated: false }
    ])
    expect(predicates('file:a name:b path:c').map((p) => p.kind === 'text' && p.field)).toEqual([
      'filename',
      'filename',
      'folder'
    ])
  })

  it('keeps a quoted flag value together', () => {
    expect(predicates('comment:"a day at the shore"')).toEqual([
      { kind: 'text', field: 'comment', value: 'a day at the shore', negated: false }
    ])
  })

  it('is case-insensitive on the flag but preserves the value as typed', () => {
    expect(predicates('COMMENT:Beach')).toEqual([
      { kind: 'text', field: 'comment', value: 'Beach', negated: false }
    ])
  })
})

describe('set flags', () => {
  it('parses tag and person as exact-set predicates', () => {
    expect(predicates('tag:beach person:joe')).toEqual([
      { kind: 'set', field: 'tag', value: 'beach', negated: false },
      { kind: 'set', field: 'person', value: 'joe', negated: false }
    ])
  })

  it('keeps repeated person flags as separate predicates so they can intersect', () => {
    expect(predicates('person:joe person:mary')).toHaveLength(2)
  })
})

describe('structured flags', () => {
  it('encodes before/after as comparisons on their own field', () => {
    expect(predicates('before:2020 after:2015')).toEqual([
      { kind: 'structured', field: 'before', op: '<', value: '2020', negated: false },
      { kind: 'structured', field: 'after', op: '>', value: '2015', negated: false }
    ])
  })

  it('parses comparison operators in a value', () => {
    expect(predicates('views:>5')).toEqual([
      { kind: 'structured', field: 'views', op: '>', value: '5', negated: false }
    ])
    expect(predicates('views:>=10')[0]).toMatchObject({ op: '>=', value: '10' })
  })

  it('lets an explicit operator in the value override the flag default', () => {
    expect(predicates('added:>2024')[0]).toMatchObject({ field: 'added', op: '>', value: '2024' })
  })

  it('parses year, camera, and format', () => {
    expect(predicates('year:2024 camera:fuji format:jpeg')).toEqual([
      { kind: 'structured', field: 'year', op: '=', value: '2024', negated: false },
      { kind: 'structured', field: 'camera', op: '=', value: 'fuji', negated: false },
      { kind: 'structured', field: 'format', op: '=', value: 'jpeg', negated: false }
    ])
  })
})

describe('boolean flags', () => {
  it('parses is:/has: into flag predicates', () => {
    expect(predicates('is:untagged has:faces has:comment')).toEqual([
      { kind: 'flag', field: 'untagged', negated: false },
      { kind: 'flag', field: 'faces', negated: false },
      { kind: 'flag', field: 'comment-present', negated: false }
    ])
  })

  it('distinguishes has:comment from the comment: text flag', () => {
    expect(predicates('has:comment')[0]).toMatchObject({ kind: 'flag' })
    expect(predicates('comment:x')[0]).toMatchObject({ kind: 'text' })
  })

  it('falls back to literal text for an unknown is: value', () => {
    expect(predicates('is:banana')).toEqual([
      { kind: 'text', field: 'any', value: 'is:banana', negated: false }
    ])
  })
})

describe('negation', () => {
  it('negates bare terms and any flag', () => {
    expect(predicates('-blurry -tag:screenshots -is:untagged')).toEqual([
      { kind: 'text', field: 'any', value: 'blurry', negated: true },
      { kind: 'set', field: 'tag', value: 'screenshots', negated: true },
      { kind: 'flag', field: 'untagged', negated: true }
    ])
  })

  it('treats a lone hyphen as literal text, not a negation of nothing', () => {
    expect(predicates('-')).toEqual([{ kind: 'text', field: 'any', value: '-', negated: false }])
  })

  it('does not strip a hyphen inside a quoted phrase', () => {
    expect(predicates('"-5 degrees"')).toEqual([
      { kind: 'text', field: 'any', value: '-5 degrees', negated: false }
    ])
  })
})

// The parser is total: a half-typed query is the normal state of an
// incremental search box, so nothing here may throw.
describe('malformed input degrades instead of throwing', () => {
  it.each([
    'comment:',
    ':',
    '::',
    'comment::beach',
    '"unterminated',
    "don't",
    'a:b:c',
    '-:',
    '   :   ',
    '****',
    'tag:"'
  ])('survives %j', (input) => {
    expect(() => parseSearchQuery(input)).not.toThrow()
    expect(Array.isArray(parseSearchQuery(input).predicates)).toBe(true)
  })

  it('drops a trailing colon so a partially typed flag still searches', () => {
    expect(predicates('beach:')).toEqual([
      { kind: 'text', field: 'any', value: 'beach', negated: false }
    ])
  })

  it('keeps an unknown flag as literal text, colon included', () => {
    expect(predicates('http://example.com')).toEqual([
      { kind: 'text', field: 'any', value: 'http://example.com', negated: false }
    ])
  })

  it('swallows the rest of the input on an unterminated quote', () => {
    expect(predicates('"family trip')).toEqual([
      { kind: 'text', field: 'any', value: 'family trip', negated: false }
    ])
  })

  it('handles an apostrophe mid-word without losing the token', () => {
    // The apostrophe opens a quote that never closes, so the remainder is
    // literal — the important part is that a predicate still comes back.
    expect(predicates("don't")).toHaveLength(1)
  })
})

describe('serialize', () => {
  it('round-trips every predicate kind back to an equivalent query', () => {
    const inputs = [
      'beach',
      'beach sunset',
      'filename:IMG comment:beach folder:2024',
      'tag:beach person:joe',
      'before:2020 after:2015',
      'views:>5',
      'views:>=10',
      'year:2024 camera:fuji format:jpeg',
      'is:untagged has:faces has:comment',
      '-blurry -tag:screenshots -is:untagged',
      'comment:"a day at the shore"',
      'person:joe person:mary before:2020'
    ]
    for (const input of inputs) {
      const once = parseSearchQuery(input)
      const twice = parseSearchQuery(serializeSearchQuery(once))
      expect(twice.predicates).toEqual(once.predicates)
    }
  })

  it('quotes a value containing whitespace so it survives re-tokenizing', () => {
    const query = parseSearchQuery('comment:"a day"')
    expect(serializeSearchQuery(query)).toBe('comment:"a day"')
    expect(parseSearchQuery(serializeSearchQuery(query)).predicates).toEqual(query.predicates)
  })

  it('quotes a bare term containing a colon so it does not become a flag', () => {
    const query = parseSearchQuery('http://example.com')
    const round = parseSearchQuery(serializeSearchQuery(query))
    expect(round.predicates).toEqual(query.predicates)
  })

  it('omits a redundant operator for before/after', () => {
    expect(serializeSearchQuery(parseSearchQuery('before:2020'))).toBe('before:2020')
  })
})

describe('togglePredicate', () => {
  const tagBeach: Predicate = { kind: 'set', field: 'tag', value: 'beach', negated: false }

  it('adds a predicate that is not present', () => {
    const next = togglePredicate(parseSearchQuery(''), tagBeach)
    expect(next.predicates).toEqual([tagBeach])
  })

  it('removes an equivalent predicate that is already present', () => {
    const next = togglePredicate(parseSearchQuery('tag:beach'), tagBeach)
    expect(next.predicates).toEqual([])
  })

  it('matches case-insensitively, so a chip toggles a differently-cased flag', () => {
    const next = togglePredicate(parseSearchQuery('tag:BEACH'), tagBeach)
    expect(next.predicates).toEqual([])
  })

  it('leaves a negated counterpart alone — it is a different filter', () => {
    const next = togglePredicate(parseSearchQuery('-tag:beach'), tagBeach)
    expect(next.predicates).toHaveLength(2)
  })

  it('preserves includeExcluded across a toggle', () => {
    const query = { ...parseSearchQuery('beach'), includeExcluded: true }
    expect(togglePredicate(query, tagBeach).includeExcluded).toBe(true)
  })
})
