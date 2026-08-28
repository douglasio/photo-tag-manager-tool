import { isUnderExcludedFolder } from '@shared/folderExclusion'
import type { Predicate, SearchQuery } from '@shared/searchQuery'
import type { SearchHit, SearchResult } from '@shared/types'

import { getDb } from './database'
import { getPeople, getPersonPhotoAssignments } from './faceRepository'
import { getExcludedFolders } from './settingsRepository'

// Index-free by design: the searchable corpus is ~100-200 bytes per photo, so
// scanning it costs single-digit ms at this app's scale and there is no index
// to fall out of sync with the photos table. See docs/SEARCH_PLAN.md for the
// measurements and the FTS5 escalation path if a library ever outgrows this.
interface SearchRow {
  path: string
  fileName: string
  comment: string | null
  tags: string
  dateTaken: string | null
  cameraMake: string | null
  cameraModel: string | null
  format: string
  viewCount: number
  firstSeenAt: number | null
  thumbnailKey: string | null
  thumbnailStatus: string
}

// Field weights x match quality. Deliberately a documented heuristic rather
// than bm25 — personal-library queries are 1-3 terms, where this ranks
// comparably and stays explainable when a result looks wrong.
const FIELD_WEIGHT = { filename: 3, tags: 2.5, folder: 1.5, comment: 1 } as const
const EXACT_BONUS = 2
const PREFIX_BONUS = 1.5
const SUBSTRING_BONUS = 1

// Unicode-aware, unlike SQLite's ASCII-only lower()/LIKE.
function fold(value: string): string {
  return value.toLocaleLowerCase()
}

function parseTags(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((tag) => String(tag)) : []
  } catch {
    return []
  }
}

function folderOf(path: string): string {
  const separator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return separator > 0 ? path.slice(0, separator) : path
}

/** 0 when absent, higher the more exact the match. */
function matchScore(haystack: string | null, needle: string): number {
  if (!haystack || needle.length === 0) return 0
  const text = fold(haystack)
  const index = text.indexOf(needle)
  if (index < 0) return 0
  if (text === needle) return EXACT_BONUS
  // Word-boundary starts read as "prefix" — `IMG` in `IMG_1234.jpg` should
  // outrank an incidental substring hit.
  if (index === 0 || /[\s_\-/\\.]/.test(text[index - 1])) return PREFIX_BONUS
  return SUBSTRING_BONUS
}

function tagsMatchScore(tags: string[], needle: string): number {
  let best = 0
  for (const tag of tags) best = Math.max(best, matchScore(tag, needle))
  return best
}

// The date columns hold ISO-ish strings; comparing their leading YYYY is
// enough for year/before/after and avoids parsing partial dates.
function yearOf(value: string | null): number | null {
  if (!value) return null
  const year = Number(value.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

function compare(left: number, op: string, right: number): boolean {
  switch (op) {
    case '<':
      return left < right
    case '>':
      return left > right
    case '<=':
      return left <= right
    case '>=':
      return left >= right
    default:
      return left === right
  }
}

interface RowContext {
  row: SearchRow
  tags: string[]
  folder: string
}

/** Text predicates contribute to ranking; everything else is pass/fail. */
function evaluateText(context: RowContext, predicate: Predicate & { kind: 'text' }): number {
  const needle = fold(predicate.value)
  if (needle.length === 0) return 0
  const { row, tags, folder } = context
  switch (predicate.field) {
    case 'filename':
      return matchScore(row.fileName, needle) * FIELD_WEIGHT.filename
    case 'comment':
      return matchScore(row.comment, needle) * FIELD_WEIGHT.comment
    case 'folder':
      return matchScore(folder, needle) * FIELD_WEIGHT.folder
    case 'any':
      return (
        matchScore(row.fileName, needle) * FIELD_WEIGHT.filename +
        tagsMatchScore(tags, needle) * FIELD_WEIGHT.tags +
        matchScore(folder, needle) * FIELD_WEIGHT.folder +
        matchScore(row.comment, needle) * FIELD_WEIGHT.comment
      )
  }
}

function evaluateStructured(
  context: RowContext,
  predicate: Predicate & { kind: 'structured' }
): boolean {
  const { row } = context
  switch (predicate.field) {
    case 'year':
    case 'before':
    case 'after': {
      const year = yearOf(row.dateTaken)
      const target = Number(predicate.value.slice(0, 4))
      if (year === null || !Number.isFinite(target)) return false
      return compare(year, predicate.op, target)
    }
    case 'added': {
      if (row.firstSeenAt === null) return false
      const year = new Date(row.firstSeenAt).getFullYear()
      const target = Number(predicate.value.slice(0, 4))
      if (!Number.isFinite(target)) return false
      return compare(year, predicate.op, target)
    }
    case 'camera': {
      const needle = fold(predicate.value)
      return matchScore(row.cameraMake, needle) > 0 || matchScore(row.cameraModel, needle) > 0
    }
    case 'views': {
      const target = Number(predicate.value)
      if (!Number.isFinite(target)) return false
      return compare(row.viewCount, predicate.op, target)
    }
    case 'format':
      return fold(row.format) === fold(predicate.value)
  }
}

function evaluateFlag(context: RowContext, predicate: Predicate & { kind: 'flag' }): boolean {
  switch (predicate.field) {
    case 'untagged':
      return context.tags.length === 0
    case 'comment-present':
      return Boolean(context.row.comment && context.row.comment.trim().length > 0)
    case 'faces':
      // Resolved by the caller against the face-assignment set, since it needs
      // a cross-table lookup this row-local evaluator can't do.
      return false
  }
}

// Tag and person values resolve to path sets up front (one pass over the
// people/faces tables) rather than per row, so a `person:` predicate costs a
// set lookup instead of a join per photo.
function resolvePersonPaths(value: string): Set<string> {
  const needle = fold(value)
  const matchingIds = new Set(
    getPeople()
      .filter((person) => person.name !== null && fold(person.name).includes(needle))
      .map((person) => person.id)
  )
  const paths = new Set<string>()
  if (matchingIds.size === 0) return paths
  for (const assignment of getPersonPhotoAssignments()) {
    if (matchingIds.has(assignment.personId)) paths.add(assignment.photoPath)
  }
  return paths
}

function allFacePaths(): Set<string> {
  return new Set(getPersonPhotoAssignments().map((assignment) => assignment.photoPath))
}

export interface SearchOptions {
  /** Cap on returned hits. The reported total always counts every match. */
  limit?: number
}

export function searchPhotos(query: SearchQuery, options: SearchOptions = {}): SearchResult {
  const { limit = 50 } = options
  if (query.predicates.length === 0) return { hits: [], total: 0, paths: [] }

  const excludedFolders = query.includeExcluded ? [] : getExcludedFolders()

  // Cross-table predicates resolve once, before the scan.
  const personSets: { paths: Set<string>; negated: boolean }[] = []
  let facePaths: Set<string> | null = null
  for (const predicate of query.predicates) {
    if (predicate.kind === 'set' && predicate.field === 'person') {
      personSets.push({ paths: resolvePersonPaths(predicate.value), negated: predicate.negated })
    }
    if (predicate.kind === 'flag' && predicate.field === 'faces' && facePaths === null) {
      facePaths = allFacePaths()
    }
  }

  const rows = getDb()
    .prepare(
      `SELECT path, fileName, comment, tags, dateTaken, cameraMake, cameraModel,
              format, viewCount, firstSeenAt, thumbnailKey, thumbnailStatus
       FROM photos`
    )
    .all() as SearchRow[]

  const scored: { hit: SearchHit; sortDate: string }[] = []

  for (const row of rows) {
    if (excludedFolders.length > 0 && isUnderExcludedFolder(row.path, excludedFolders)) continue

    const context: RowContext = {
      row,
      tags: parseTags(row.tags),
      folder: folderOf(row.path)
    }

    let score = 0
    let matched = true
    let personIndex = 0

    for (const predicate of query.predicates) {
      let passes: boolean
      let contribution = 0

      if (predicate.kind === 'text') {
        contribution = evaluateText(context, predicate)
        passes = contribution > 0
      } else if (predicate.kind === 'set' && predicate.field === 'tag') {
        const needle = fold(predicate.value)
        passes = context.tags.some((tag) => fold(tag) === needle)
        contribution = passes ? FIELD_WEIGHT.tags * EXACT_BONUS : 0
      } else if (predicate.kind === 'set') {
        // Person sets were resolved above, in predicate order.
        passes = personSets[personIndex].paths.has(row.path)
        personIndex += 1
      } else if (predicate.kind === 'structured') {
        passes = evaluateStructured(context, predicate)
      } else if (predicate.field === 'faces') {
        passes = facePaths !== null && facePaths.has(row.path)
      } else {
        passes = evaluateFlag(context, predicate)
      }

      if (predicate.negated) {
        // A negated predicate that holds disqualifies the row, and a negation
        // never contributes to relevance.
        if (passes) {
          matched = false
          break
        }
      } else if (!passes) {
        matched = false
        break
      } else {
        score += contribution
      }
    }

    if (!matched) continue

    scored.push({
      hit: {
        filePath: row.path,
        fileName: row.fileName,
        score,
        thumbnailKey: row.thumbnailStatus === 'ready' && row.thumbnailKey ? row.thumbnailKey : null
      },
      sortDate: row.dateTaken ?? ''
    })
  }

  // Recency breaks score ties — the Picasa-ish "newest first" feel.
  scored.sort((a, b) => b.hit.score - a.hit.score || b.sortDate.localeCompare(a.sortDate))

  return {
    hits: scored.slice(0, limit).map((entry) => entry.hit),
    total: scored.length,
    paths: scored.map((entry) => entry.hit.filePath)
  }
}
