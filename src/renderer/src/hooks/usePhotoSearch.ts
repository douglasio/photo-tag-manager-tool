import { useEffect, useRef, useState } from 'react'

import { parseSearchQuery, type Predicate, type SearchQuery } from '@shared/searchQuery'
import type { SearchResult, SemanticSearchResult } from '@shared/types'

// Enough to feel instant while collapsing a burst of keystrokes into one
// round trip.
const DEBOUNCE_MS = 150
const SPOTLIGHT_LIMIT = 30

const EMPTY_RESULT: SearchResult = { hits: [], total: 0, paths: [] }
const EMPTY_SEMANTIC_RESULT: SemanticSearchResult = {
  hits: [],
  indexedCount: 0,
  totalReadyCount: 0
}

// Semantic search only has something to embed when the query has actual
// words in it — flags-only queries (`person:joe year:2020`) skip the round
// trip entirely rather than asking the main process to embed an empty string.
function hasFreeText(predicates: Predicate[]): boolean {
  return predicates.some(
    (predicate) =>
      predicate.kind === 'text' && !predicate.negated && predicate.value.trim().length > 0
  )
}

export interface UsePhotoSearchResult {
  text: string
  setText: (value: string) => void
  query: SearchQuery
  result: SearchResult
  loading: boolean
  semanticResult: SemanticSearchResult
  semanticLoading: boolean
  // Non-null only while the text tower's one-time model download is in
  // flight — set on every session's first-ever semantic search, never again
  // after (the worker memoizes the download). 0-100, matching AiScanProgress.
  modelDownloadProgress: number | null
  includeExcluded: boolean
  setIncludeExcluded: (value: boolean) => void
}

// Owns the search box's text, its parsed form, and the debounced query. The
// parse is shared with the main process, so both sides agree on what the text
// means without the renderer re-implementing any matching.
//
// Facet and semantic results are fetched independently: they're rendered as
// separate Spotlight groups (see SearchSpotlight and docs/SEARCH_PLAN.md's
// semantic search section — the two score spaces aren't comparable), and the
// facet scan is instant while the semantic pass may still be loading its
// model, so blocking one on the other would make every search feel as slow
// as the model's first cold start.
export function usePhotoSearch(): UsePhotoSearchResult {
  const [text, setText] = useState('')
  const [includeExcluded, setIncludeExcluded] = useState(false)
  // Tagged with the query it answers, so "is this result current?" is derived
  // during render rather than tracked by a second state write.
  const [answered, setAnswered] = useState<{ query: string; data: SearchResult }>({
    query: '',
    data: EMPTY_RESULT
  })
  const [answeredSemantic, setAnsweredSemantic] = useState<{
    query: string
    data: SemanticSearchResult
  }>({ query: '', data: EMPTY_SEMANTIC_RESULT })
  const [modelDownloadProgress, setModelDownloadProgress] = useState<number | null>(null)

  const query = parseSearchQuery(text, includeExcluded)
  const hasPredicates = query.predicates.length > 0
  const queryHasFreeText = hasFreeText(query.predicates)
  const serialized = JSON.stringify(query)

  // Monotonic request id. Bumped in cleanup too, so a response for a query the
  // user has already moved on from can never overwrite a newer one.
  const latestRequest = useRef(0)

  // Fires at most once per app session in practice (the worker memoizes the
  // text tower's download), but subscribing once here rather than per-query
  // is simplest and costs nothing extra.
  useEffect(() => window.api.onSemanticModelProgress(setModelDownloadProgress), [])

  useEffect(() => {
    const parsed: SearchQuery = JSON.parse(serialized)
    if (parsed.predicates.length === 0) return

    const requestId = ++latestRequest.current
    const timer = setTimeout(() => {
      window.api
        .searchPhotos(parsed, SPOTLIGHT_LIMIT)
        .then((data) => {
          if (latestRequest.current === requestId) setAnswered({ query: serialized, data })
        })
        .catch((error: unknown) => {
          console.error('search failed', error)
          if (latestRequest.current === requestId) {
            setAnswered({ query: serialized, data: EMPTY_RESULT })
          }
        })

      if (hasFreeText(parsed.predicates)) {
        setModelDownloadProgress(null)
        window.api
          .semanticSearchPhotos(parsed)
          .then((data) => {
            if (latestRequest.current === requestId) {
              setAnsweredSemantic({ query: serialized, data })
              setModelDownloadProgress(null)
            }
          })
          .catch((error: unknown) => {
            console.error('semantic search failed', error)
            if (latestRequest.current === requestId) {
              setAnsweredSemantic({ query: serialized, data: EMPTY_SEMANTIC_RESULT })
              setModelDownloadProgress(null)
            }
          })
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      latestRequest.current += 1
    }
  }, [serialized])

  return {
    text,
    setText,
    query,
    // Previous results stay on screen while the next query is in flight —
    // blanking the list on every keystroke reads as flicker.
    result: hasPredicates ? answered.data : EMPTY_RESULT,
    loading: hasPredicates && answered.query !== serialized,
    semanticResult: queryHasFreeText ? answeredSemantic.data : EMPTY_SEMANTIC_RESULT,
    semanticLoading: queryHasFreeText && answeredSemantic.query !== serialized,
    modelDownloadProgress,
    includeExcluded,
    setIncludeExcluded
  }
}
