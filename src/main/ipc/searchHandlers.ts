import { ipcMain } from 'electron'

import { searchPhotos } from '@main/db/searchRepository'
import { semanticSearchPhotos } from '@main/services/semanticSearchService'
import type { SearchQuery } from '@shared/searchQuery'
import type { SearchResult, SemanticSearchResult } from '@shared/types'

export function registerSearchHandlers(): void {
  ipcMain.handle('search:query', (_event, query: SearchQuery, limit: number): SearchResult =>
    searchPhotos(query, { limit })
  )
  // The progress callback only ever fires anything on the very first
  // semantic search in a session (the text tower's download is memoized
  // after that) — see tagSuggestionService.embedText.
  ipcMain.handle('search:semantic', (event, query: SearchQuery): Promise<SemanticSearchResult> =>
    semanticSearchPhotos(query, (progress) =>
      event.sender.send('search:semanticModelProgress', progress)
    )
  )
}
