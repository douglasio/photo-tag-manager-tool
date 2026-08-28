import { ipcMain } from 'electron'

import { searchPhotos } from '@main/db/searchRepository'
import { semanticSearchPhotos } from '@main/services/semanticSearchService'
import type { SearchQuery } from '@shared/searchQuery'
import type { SearchResult, SemanticSearchResult } from '@shared/types'

export function registerSearchHandlers(): void {
  ipcMain.handle('search:query', (_event, query: SearchQuery, limit: number): SearchResult =>
    searchPhotos(query, { limit })
  )
  ipcMain.handle('search:semantic', (_event, query: SearchQuery): Promise<SemanticSearchResult> =>
    semanticSearchPhotos(query)
  )
}
