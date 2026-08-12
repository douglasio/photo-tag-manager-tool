import { useEffect, useState } from 'react'

import type { TagSuggestion } from '@shared/types'
import { usePhotoLibrary } from '@state'

const MAX_SUGGESTIONS = 5

export interface UseTagSuggestionsResult {
  suggestions: TagSuggestion[]
  loading: boolean
}

// Shared by DetailPanelQuickTag and the QuickTag dashboard widget — fetches
// AI tag suggestions for one photo whenever it (or `active`) changes,
// filtering out tags the photo already has and capping the result.
export function useTagSuggestions(
  filePath: string,
  currentTags: string[],
  active: boolean
): UseTagSuggestionsResult {
  const { allTags, suggestTags } = usePhotoLibrary()
  const suggestionsActive = active && allTags.length > 0
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([])
  // Lazy-init so the very first render already reflects a pending fetch,
  // not just subsequent request-key changes (see the render-adjustment below).
  const [loading, setLoading] = useState(() => suggestionsActive)
  const requestKey = `${filePath}::${suggestionsActive}`

  // Adjust-during-render (not an effect) the instant the request key
  // changes — flips the loading flag immediately, not a tick late.
  const [trackedKey, setTrackedKey] = useState(requestKey)
  if (trackedKey !== requestKey) {
    setTrackedKey(requestKey)
    if (suggestionsActive) setLoading(true)
  }

  useEffect(() => {
    if (!suggestionsActive) return
    let cancelled = false
    suggestTags(filePath, allTags)
      .then((results) => {
        if (!cancelled) setSuggestions(results)
      })
      .catch((err: unknown) => {
        console.error('failed to get tag suggestions', err)
        if (!cancelled) setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filePath, suggestionsActive, allTags, suggestTags])

  // Slice before filtering — locks the visible set to what was on top when
  // suggestions were fetched, so accepting one shrinks the row instead of
  // backfilling from candidates that were originally ranked below the cutoff.
  const topSuggestions = suggestionsActive
    ? suggestions
        .slice(0, MAX_SUGGESTIONS)
        .filter((suggestion) => !currentTags.includes(suggestion.tag))
    : []

  return { suggestions: topSuggestions, loading: suggestionsActive && loading }
}
