import { getAllEmbeddings } from '@main/db/embeddingRepository'
import { findAllReadyPhotos, findByPath } from '@main/db/photoRepository'
import { searchPhotos } from '@main/db/searchRepository'
import { getAiTagSuggestionsEnabled } from '@main/db/settingsRepository'
import type { Predicate, SearchQuery } from '@shared/searchQuery'
import type { SearchHit, SemanticSearchResult } from '@shared/types'

import { cosineSimilarity } from './embeddingSimilarity'
import { embedText } from './tagSuggestionService'

// Cosine similarity below this reads as noise rather than a real visual
// match for Xenova/clip-vit-base-patch32 — a starting point, worth tuning
// against a real library once this ships.
const SIMILARITY_THRESHOLD = 0.2
const MAX_HITS = 8

// The phrase to embed: every non-negated text predicate joined back
// together. Flags/facets don't have visual meaning, so they're excluded
// here and applied as filters instead (see below).
function freeTextPhrase(predicates: Predicate[]): string {
  return predicates
    .filter(
      (predicate): predicate is Predicate & { kind: 'text' } =>
        predicate.kind === 'text' && !predicate.negated
    )
    .map((predicate) => predicate.value)
    .join(' ')
    .trim()
}

// Runs alongside the exact facet scan as a second result source. Facets
// (tag/person/structured/flag) filter which photos are eligible; CLIP
// similarity ranks them by how well they visually match the free text. Text
// predicates are deliberately not applied as filters here — a literal
// substring miss on "beach" shouldn't block a photo that visually *is* a
// beach, which is the entire point of this feature.
export async function semanticSearchPhotos(query: SearchQuery): Promise<SemanticSearchResult> {
  const empty: SemanticSearchResult = { hits: [], indexedCount: 0, totalReadyCount: 0 }
  // Gated here rather than by the renderer, so the Spotlight component
  // doesn't need to subscribe to AI-settings state just to decide whether to
  // fire this request — it always can, and this resolves immediately when off.
  if (!getAiTagSuggestionsEnabled()) return empty

  const phrase = freeTextPhrase(query.predicates)
  if (phrase.length === 0) return empty

  const nonTextPredicates = query.predicates.filter((predicate) => predicate.kind !== 'text')
  let candidatePaths: Set<string> | null = null
  if (nonTextPredicates.length > 0) {
    const filtered = searchPhotos(
      { predicates: nonTextPredicates, includeExcluded: query.includeExcluded },
      { limit: Number.MAX_SAFE_INTEGER }
    )
    if (filtered.paths.length === 0) return empty
    candidatePaths = new Set(filtered.paths)
  }

  const queryEmbedding = await embedText(phrase)

  // Always respects excluded folders regardless of the includeExcluded
  // toggle — getAllEmbeddings has no override, and this feature is new
  // enough that the mismatch isn't worth widening that cache's contract for.
  const embeddings = getAllEmbeddings()

  const scored: { filePath: string; score: number }[] = []
  for (const { filePath, embedding } of embeddings) {
    if (candidatePaths && !candidatePaths.has(filePath)) continue
    const score = cosineSimilarity(queryEmbedding, embedding)
    if (score >= SIMILARITY_THRESHOLD) scored.push({ filePath, score })
  }
  scored.sort((a, b) => b.score - a.score)

  const hits: SearchHit[] = []
  for (const { filePath, score } of scored.slice(0, MAX_HITS)) {
    const found = findByPath(filePath)
    if (!found) continue
    hits.push({
      filePath,
      fileName: found.record.fileName,
      score,
      thumbnailKey: found.record.thumbnailStatus === 'ready' ? found.record.thumbnailKey : null
    })
  }

  return {
    hits,
    indexedCount: embeddings.length,
    totalReadyCount: findAllReadyPhotos().length
  }
}
