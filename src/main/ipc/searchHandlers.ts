import { ipcMain } from 'electron'

import { searchPhotos } from '@main/db/searchRepository'
import type { SearchQuery } from '@shared/searchQuery'
import type { SearchResult } from '@shared/types'

// One channel for the whole feature: the renderer sends a parsed query (the
// parser is shared code, so both sides agree on its shape) and gets back
// ranked hits plus the full path list for gallery filtering.
export function registerSearchHandlers(): void {
  ipcMain.handle('search:query', (_event, query: SearchQuery, limit: number): SearchResult =>
    searchPhotos(query, { limit })
  )
}
