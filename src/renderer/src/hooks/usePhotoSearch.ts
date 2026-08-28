import { useEffect, useRef, useState } from 'react'

import { parseSearchQuery, type SearchQuery } from '@shared/searchQuery'
import type { SearchResult } from '@shared/types'

// Enough to feel instant while collapsing a burst of keystrokes into one
// round trip.
const DEBOUNCE_MS = 150
const SPOTLIGHT_LIMIT = 30

const EMPTY_RESULT: SearchResult = { hits: [], total: 0, paths: [] }

export interface UsePhotoSearchResult {
  text: string
  setText: (value: string) => void
  query: SearchQuery
  result: SearchResult
  loading: boolean
  includeExcluded: boolean
  setIncludeExcluded: (value: boolean) => void
}

// Owns the search box's text, its parsed form, and the debounced query. The
// parse is shared with the main process, so both sides agree on what the text
// means without the renderer re-implementing any matching.
export function usePhotoSearch(): UsePhotoSearchResult {
  const [text, setText] = useState('')
  const [includeExcluded, setIncludeExcluded] = useState(false)
  // Tagged with the query it answers, so "is this result current?" is derived
  // during render rather than tracked by a second state write.
  const [answered, setAnswered] = useState<{ query: string; data: SearchResult }>({
    query: '',
    data: EMPTY_RESULT
  })

  const query = parseSearchQuery(text, includeExcluded)
  const hasPredicates = query.predicates.length > 0
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
    includeExcluded,
    setIncludeExcluded
  }
}
