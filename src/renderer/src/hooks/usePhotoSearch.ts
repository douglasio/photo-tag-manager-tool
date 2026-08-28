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
  includeExcluded: boolean
  setIncludeExcluded: (value: boolean) => void
}

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

  const query = parseSearchQuery(text, includeExcluded)
  const hasPredicates = query.predicates.length > 0
  const queryHasFreeText = hasFreeText(query.predicates)
  const serialized = JSON.stringify(query)

  // Monotonic request id. Bumped in cleanup too, so a response for a query the
  // user has already moved on from can never overwrite a newer one.
  const latestRequest = useRef(0)

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
        window.api
          .semanticSearchPhotos(parsed)
          .then((data) => {
            if (latestRequest.current === requestId)
              setAnsweredSemantic({ query: serialized, data })
          })
          .catch((error: unknown) => {
            console.error('semantic search failed', error)
            if (latestRequest.current === requestId) {
              setAnsweredSemantic({ query: serialized, data: EMPTY_SEMANTIC_RESULT })
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
    includeExcluded,
    setIncludeExcluded
  }
}
