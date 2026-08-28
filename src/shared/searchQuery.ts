// Parses the search box's text into a structured query, and serializes it
// back. Both directions matter: facet chips in the UI mutate the parsed form
// and are re-serialized into the input, so typed flags and chips stay one
// source of truth instead of drifting apart.
//
// Deliberately total: no input throws. Malformed text (an unbalanced quote, a
// bare `:`, an unknown flag) degrades into literal search terms, because a
// half-typed query is the normal state of an incremental search box.

/** Fields matched by substring, scanned across the photo row. */
export type TextField = 'filename' | 'comment' | 'folder' | 'any'

/** Entities matched exactly against a controlled vocabulary, not as text. */
export type SetField = 'tag' | 'person'

/** Scalar columns compared with an operator. */
export type StructuredField = 'year' | 'before' | 'after' | 'added' | 'camera' | 'views' | 'format'

/** Boolean predicates with no value of their own. */
export type FlagField = 'untagged' | 'faces' | 'comment-present'

export type ComparisonOp = '=' | '<' | '>' | '<=' | '>='

export interface TextPredicate {
  kind: 'text'
  field: TextField
  value: string
  negated: boolean
}

export interface SetPredicate {
  kind: 'set'
  field: SetField
  value: string
  negated: boolean
}

export interface StructuredPredicate {
  kind: 'structured'
  field: StructuredField
  op: ComparisonOp
  value: string
  negated: boolean
}

export interface FlagPredicate {
  kind: 'flag'
  field: FlagField
  negated: boolean
}

export type Predicate = TextPredicate | SetPredicate | StructuredPredicate | FlagPredicate

// A flat conjunction — every predicate must match. Compound search (roadmap
// Shell #4) generalizes this to an expression tree with OR/grouping over this
// same Predicate type, so this shape is deliberately that tree's leaf level.
export interface SearchQuery {
  predicates: Predicate[]
  /** Excluded-folder photos are filtered out unless this is set. */
  includeExcluded: boolean
}

export const EMPTY_QUERY: SearchQuery = { predicates: [], includeExcluded: false }

const TEXT_FLAGS: Record<string, TextField> = {
  filename: 'filename',
  file: 'filename',
  name: 'filename',
  comment: 'comment',
  folder: 'folder',
  path: 'folder'
}

const SET_FLAGS: Record<string, SetField> = {
  tag: 'tag',
  person: 'person',
  who: 'person'
}

// `year` is a shorthand for equality on the date; before/after carry their
// comparison in the flag name itself.
const DATE_FLAGS: Record<string, { field: StructuredField; op: ComparisonOp }> = {
  year: { field: 'year', op: '=' },
  before: { field: 'before', op: '<' },
  after: { field: 'after', op: '>' },
  added: { field: 'added', op: '=' }
}

const PLAIN_STRUCTURED_FLAGS: Record<string, StructuredField> = {
  camera: 'camera',
  format: 'format'
}

// `is:` / `has:` share one namespace of boolean predicates; `has:comment`
// resolves to a different field than the `comment:` text flag above.
const FLAG_VALUES: Record<string, FlagField> = {
  untagged: 'untagged',
  faces: 'faces',
  face: 'faces',
  comment: 'comment-present',
  comments: 'comment-present'
}

const COMPARISON_PREFIXES: [string, ComparisonOp][] = [
  ['>=', '>='],
  ['<=', '<='],
  ['>', '>'],
  ['<', '<']
]

interface RawToken {
  text: string
  /** The token *opened* with a quote, so the whole thing is a literal phrase.
   * A quote later in the token (`comment:"a day"`) only groups that value —
   * the flag prefix ahead of it is still a flag. */
  quoted: boolean
}

// Splits on whitespace while keeping quoted runs together. An unterminated
// quote swallows the rest of the input rather than erroring, which is what a
// user mid-typing actually wants.
function tokenize(input: string): RawToken[] {
  const tokens: RawToken[] = []
  let current = ''
  let quoteChar: string | null = null
  let hadQuote = false
  let leadingQuote = false

  const push = (): void => {
    if (current.length > 0 || hadQuote) tokens.push({ text: current, quoted: leadingQuote })
    current = ''
    hadQuote = false
    leadingQuote = false
  }

  for (const char of input) {
    if (quoteChar) {
      if (char === quoteChar) {
        quoteChar = null
      } else {
        current += char
      }
      continue
    }
    if (char === '"' || char === "'") {
      quoteChar = char
      if (!hadQuote && current.length === 0) leadingQuote = true
      hadQuote = true
      continue
    }
    if (/\s/.test(char)) {
      push()
      continue
    }
    current += char
  }
  push()
  return tokens
}

function splitComparison(raw: string): { op: ComparisonOp; value: string } {
  for (const [prefix, op] of COMPARISON_PREFIXES) {
    if (raw.startsWith(prefix)) return { op, value: raw.slice(prefix.length) }
  }
  return { op: '=', value: raw }
}

function textPredicate(field: TextField, value: string, negated: boolean): TextPredicate {
  return { kind: 'text', field, value, negated }
}

// A flag whose value is missing (`tag:`) or unrecognized falls back to
// searching the whole token as literal text, so a partially typed flag still
// returns something instead of silently matching nothing.
function parseToken(token: RawToken): Predicate | null {
  const { text, quoted } = token
  if (text.length === 0) return null

  let body = text
  let negated = false
  if (!quoted && body.startsWith('-') && body.length > 1) {
    negated = true
    body = body.slice(1)
  }

  if (quoted) return textPredicate('any', body, negated)

  const colon = body.indexOf(':')
  if (colon <= 0 || colon === body.length - 1) {
    // No flag, or a dangling `foo:` — treat the whole thing as free text,
    // minus a trailing colon so `beach:` searches for "beach".
    const literal = colon === body.length - 1 ? body.slice(0, -1) : body
    return literal.length > 0 ? textPredicate('any', literal, negated) : null
  }

  const flag = body.slice(0, colon).toLowerCase()
  const rawValue = body.slice(colon + 1)

  const textField = TEXT_FLAGS[flag]
  if (textField) return textPredicate(textField, rawValue, negated)

  const setField = SET_FLAGS[flag]
  if (setField) return { kind: 'set', field: setField, value: rawValue, negated }

  if (flag === 'is' || flag === 'has') {
    const flagField = FLAG_VALUES[rawValue.toLowerCase()]
    if (flagField) return { kind: 'flag', field: flagField, negated }
    return textPredicate('any', body, negated)
  }

  const dateFlag = DATE_FLAGS[flag]
  if (dateFlag) {
    const { op, value } = splitComparison(rawValue)
    return {
      kind: 'structured',
      field: dateFlag.field,
      // An explicit comparison in the value wins over the flag's implied one,
      // so `added:>2024` behaves as written.
      op: op === '=' ? dateFlag.op : op,
      value,
      negated
    }
  }

  const plainField = PLAIN_STRUCTURED_FLAGS[flag]
  if (plainField) {
    return { kind: 'structured', field: plainField, op: '=', value: rawValue, negated }
  }

  if (flag === 'views') {
    const { op, value } = splitComparison(rawValue)
    return { kind: 'structured', field: 'views', op, value, negated }
  }

  // Unknown flag: the colon is probably part of what the user is looking for.
  return textPredicate('any', body, negated)
}

export function parseSearchQuery(input: string, includeExcluded = false): SearchQuery {
  const predicates: Predicate[] = []
  for (const token of tokenize(input)) {
    const predicate = parseToken(token)
    if (predicate) predicates.push(predicate)
  }
  return { predicates, includeExcluded }
}

const TEXT_FIELD_FLAG: Record<Exclude<TextField, 'any'>, string> = {
  filename: 'filename',
  comment: 'comment',
  folder: 'folder'
}

const FLAG_FIELD_VALUE: Record<FlagField, string> = {
  untagged: 'is:untagged',
  faces: 'has:faces',
  'comment-present': 'has:comment'
}

const STRUCTURED_FIELD_FLAG: Record<StructuredField, string> = {
  year: 'year',
  before: 'before',
  after: 'after',
  added: 'added',
  camera: 'camera',
  views: 'views',
  format: 'format'
}

// Quotes anything that would otherwise re-tokenize differently, so
// serialize -> parse round-trips to an equivalent query.
function quoteIfNeeded(value: string): string {
  if (value.length === 0) return '""'
  return /[\s"']/.test(value) ? `"${value.replace(/"/g, '')}"` : value
}

function serializePredicate(predicate: Predicate): string {
  const prefix = predicate.negated ? '-' : ''
  switch (predicate.kind) {
    case 'text': {
      if (predicate.field === 'any') {
        // A bare term containing a colon would re-parse as a flag, so it has
        // to come back quoted.
        const needsQuote = predicate.value.includes(':')
        return prefix + (needsQuote ? `"${predicate.value}"` : quoteIfNeeded(predicate.value))
      }
      return `${prefix}${TEXT_FIELD_FLAG[predicate.field]}:${quoteIfNeeded(predicate.value)}`
    }
    case 'set':
      return `${prefix}${predicate.field}:${quoteIfNeeded(predicate.value)}`
    case 'structured': {
      const flag = STRUCTURED_FIELD_FLAG[predicate.field]
      // before/after already encode their comparison in the flag name.
      const impliedOp = DATE_FLAGS[flag]?.op
      const op = predicate.op === impliedOp || predicate.op === '=' ? '' : predicate.op
      return `${prefix}${flag}:${op}${quoteIfNeeded(predicate.value)}`
    }
    case 'flag':
      return prefix + FLAG_FIELD_VALUE[predicate.field]
  }
}

export function serializeSearchQuery(query: SearchQuery): string {
  return query.predicates.map(serializePredicate).join(' ')
}

export function isEmptyQuery(query: SearchQuery): boolean {
  return query.predicates.length === 0
}

// Identity for chip toggling — two predicates that would filter identically
// share a key, so adding a chip that's already present is a no-op.
export function predicateKey(predicate: Predicate): string {
  switch (predicate.kind) {
    case 'text':
      return `text:${predicate.field}:${predicate.value.toLowerCase()}:${predicate.negated}`
    case 'set':
      return `set:${predicate.field}:${predicate.value.toLowerCase()}:${predicate.negated}`
    case 'structured':
      return `structured:${predicate.field}:${predicate.op}:${predicate.value.toLowerCase()}:${predicate.negated}`
    case 'flag':
      return `flag:${predicate.field}:${predicate.negated}`
  }
}

export function togglePredicate(query: SearchQuery, predicate: Predicate): SearchQuery {
  const key = predicateKey(predicate)
  const existing = query.predicates.some((item) => predicateKey(item) === key)
  return {
    ...query,
    predicates: existing
      ? query.predicates.filter((item) => predicateKey(item) !== key)
      : [...query.predicates, predicate]
  }
}
