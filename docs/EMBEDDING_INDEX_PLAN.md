# Background embedding indexer

Plan for turning CLIP photo-embedding generation from a user-triggered,
all-or-nothing batch into a background daemon that drains continuously while
the app is open, with visible progress.

## Problem

Visual/semantic search ranks photos by comparing a CLIP embedding of the query
text against per-photo embeddings cached in the `photo_embeddings` table. A
photo with no embedding simply cannot appear as a visual match.

Today the only thing that computes photo embeddings is `embedAllReadyPhotos`
(`src/main/services/photoEmbedding.ts:42`), and it is only ever called from
`runFullAiScan` (`src/main/services/aiScanService.ts:28`), which is only
reachable from three explicit user actions:

- `ai:enableAndScan` — enabling AI features (Settings, Time Warp widget)
- `ai:rescan` — DuplicatesView mount / "Scan again"
- the relaunch resume path, when `wasAiScanInterrupted()` is true
  (`PhotoLibraryContext.tsx:1355`)

Meanwhile photos become embeddable (`thumbnailStatus = 'ready'`) constantly and
silently — at the end of every folder scan (`scanHandlers.ts:191`) and on every
watcher-driven `ingestFile` (`watchManager.ts:49`). Nothing follows up. So
`indexedCount` sits frozen wherever the last full scan left it, and
SearchSpotlight's "N photos not yet indexed for visual search" line reads as a
permanently stuck counter, because it is one.

Compounding it: the only progress UI (`AiScanProgressToast`) is bound to the
full-scan flow and bundles model download + embedding + duplicate clustering
into "Step 2 of 3", so there is no signal anywhere that indexing specifically
is behind or moving.

## Goals

1. Embeddings drain automatically in the background while the app is open,
   with no user action.
2. Progress is visible and legibly _moving_, including from the search panel
   where the shortfall is surfaced.
3. Never contend with the existing full AI scan over the shared CLIP worker.

Non-goal: auto-reclustering duplicates when indexing finishes. Clustering stays
on-demand — DuplicatesView already rescans on mount, and that rescan is cheap
against a warm embedding cache.

## Design

### 1. `src/main/db/photoRepository.ts` — new query

Add `findReadyPhotosWithoutEmbeddings(limit?: number)`, mirroring
`findAllReadyPhotos()` (`photoRepository.ts:169`) but anti-joined against
`photo_embeddings`:

```sql
SELECT p.path, p.thumbnailKey FROM photos p
LEFT JOIN photo_embeddings e ON e.path = p.path
WHERE p.thumbnailStatus = 'ready' AND p.thumbnailKey IS NOT NULL
  AND e.path IS NULL
```

Keep the same post-query `isUnderExcludedFolder` filter `findAllReadyPhotos`
applies — excluded folders are a runtime setting, not baked into the SQL.

Also add `countReadyPhotosWithoutEmbeddings()` (same predicate, `COUNT(*)`) for
the status snapshot in §4 — cheaper than materializing rows.

Rationale: the current loop calls `findAllReadyPhotos()` and relies on
`getOrComputeEmbedding`'s per-path cache check to skip already-done work
(`photoEmbedding.ts:14`). That is fine for a one-shot batch but wrong for a
daemon, which needs to know _up front_ whether there is anything to do, and
needs a total that reflects remaining work rather than whole-library size.

### 2. `src/main/services/embeddingIndexService.ts` — new file

A module-level singleton drain loop. State: `running`, `suspended`,
`rekickRequested`, plus a debounce timer handle.

```ts
export function kickIndexer(): void
export async function stopIndexer(): Promise<void>
export function resumeIndexer(): void
export function getIndexStatus(): { done: number; total: number } | null
export function setIndexTarget(target: WebContents): void
```

**`kickIndexer()`** — debounced ~3s so a burst of watcher `add` events coalesces
into one pass. No-ops if `suspended`, if `!getAiTagSuggestionsEnabled()`, or if
a pass is already `running` (in which case it sets `rekickRequested` so the
current pass re-queries when it finishes, rather than exiting on a stale empty
result).

**The pass itself** — query `findReadyPhotosWithoutEmbeddings()`, then loop
sequentially calling the existing `getOrComputeEmbedding` (`photoEmbedding.ts:10`)
one photo at a time. Do not add concurrency: CLIP inference through the shared
tag-suggestion worker is the throttle, and the existing full scan is sequential
for the same reason. Wrap each photo in try/catch and log-and-skip on failure,
exactly as `embedAllReadyPhotos` does (`photoEmbedding.ts:55`) — one corrupt
file must not stall the queue forever.

Between photos, check `suspended` and bail if set. Reuse the 150ms progress
throttle constant pattern from `photoEmbedding.ts:39`.

On completion: if `rekickRequested`, clear it and re-run (new photos landed
mid-pass); otherwise broadcast `null` progress and idle.

**Model availability**: gate on `getAiTagSuggestionsEnabled()` only. That
setting is flipped exclusively by `enableAiFeaturesAndScan` _after_
`ensureModelReady` resolves (`aiScanService.ts:58-69`), so enabled implies
downloaded. Verify this holds before relying on it — the indexer must never
silently kick off a multi-hundred-MB model download.

**Broadcast**: follow `watchManager`'s established pattern for pushing from a
non-request context (`watchManager.ts:25-36`) — a module-level `WebContents`
target with an `isDestroyed()` guard, since a daemon has no `event.sender` to
reply through. Wire `setIndexTarget` alongside the existing `setWatchTarget`
calls in `src/main/index.ts:125` and `:134`.

### 3. Mutual exclusion with `runFullAiScan`

Both paths drive the same CLIP worker; they must not overlap.

Coordination lives entirely in the indexer, and `aiScanService` imports from it
one-way — **`embeddingIndexService` must not import `aiScanService`**, or the
two form a cycle.

In `runFullAiScan` (`aiScanService.ts:21`):

```ts
await stopIndexer() // before setAiScanInProgress(true)
try {
  /* existing body */
} finally {
  /* existing cleanup */ resumeIndexer()
}
```

`stopIndexer()` sets `suspended = true`, cancels the debounce timer, and awaits
the in-flight photo (resolving once the loop observes the flag). `resumeIndexer()`
clears `suspended` and kicks. Because `kickIndexer()` no-ops while suspended, a
scan completing mid-full-scan cannot start a competing pass. After a full scan
the follow-up pass finds nothing outstanding and exits immediately.

### 4. IPC

Use the `ipc-channel` skill for this — it covers the repo's
handler/preload/types conventions.

- **Push event `ai:indexProgress`**, payload `EmbeddingIndexProgress | null`
  (null = idle/finished). Add to `src/shared/types.ts` next to `AiScanProgress`
  (`types.ts:239`):
  ```ts
  export interface EmbeddingIndexProgress {
    done: number
    total: number
  }
  ```
  No `phase` field — unlike `AiScanProgress` this is single-phase.
- **Invoke `ai:getIndexStatus`** → `EmbeddingIndexProgress | null`, for initial
  state on renderer mount (a subscriber that mounts mid-pass would otherwise
  see nothing until the next tick).
- Preload: `onEmbeddingIndexProgress` via the existing `subscribe` helper, and
  `getEmbeddingIndexStatus`, alongside the current AI entries
  (`src/preload/index.ts:85-95`).

### 5. Triggers

- **Startup** — after folders are watched and AI-enabled state is known
  (`src/main/index.ts`, near the existing `setWatchTarget`/`watchFolder` block
  at `:125`). This also reduces reliance on the `wasAiScanInterrupted` resume
  path; leave that in place regardless, since it also re-clusters duplicates.
- **Scan complete** — in `runScan`, immediately before the final
  `sender.send('scan:complete', ...)` (`scanHandlers.ts:191`).
- **Watcher upsert** — in `handleUpsert`, after a successful `ingestFile`
  (`watchManager.ts:49`).

All three are fire-and-forget `kickIndexer()` calls; the debounce absorbs
overlap between them.

### 6. Renderer

**Reducer** (`photoLibraryReducer.ts`) — add `embeddingIndexProgress:
EmbeddingIndexProgress | null` to state (default `null`) and a
`SET_EMBEDDING_INDEX_PROGRESS` action, mirroring `SET_AI_SCAN_PROGRESS`
(`photoLibraryReducer.ts:240`, `:636`). Session-only, same as `aiScanProgress`.

**`PhotoLibraryContext.tsx`** — subscribe to `onEmbeddingIndexProgress` in a
mount effect, seeded by `getEmbeddingIndexStatus()`. Note this is a _different_
shape from `runAiScan` (`PhotoLibraryContext.tsx:1211`): that one subscribes per
invocation because it owns a user-initiated request; this is an ambient stream
that outlives any single action, so it belongs in a plain mount subscription.

**Toast** — new `EmbeddingIndexProgressToast`, reusing `AiScanProgressToast`'s
`RingProgress` layout (`AiScanProgressToast.tsx:22-43`) with copy like
"Indexing photos for visual search · 412 of 1,203". Deliberately quieter than
the AI-scan toast: no cancel button (it is ambient background work, and pausing
it just re-strands the backlog). Auto-dismiss on completion. Suppress while
`aiScanProgress` is non-null so the two never stack — they cannot run
concurrently anyway per §3.

**SearchSpotlight** — replace the static shortfall line
(`SearchSpotlight.tsx:281-288`, currently `unindexedCount` from
`semanticResult.totalReadyCount - indexedCount`) with a live one driven by
`embeddingIndexProgress`: "Indexing for visual search… 412 of 1,203" while a
pass is running, falling back to the existing static text when idle with a
nonzero shortfall. This is the fix for the reported symptom — the number
visibly drains instead of appearing frozen.

## Tests

- **`embeddingIndexService.test.ts`** (new): skips photos with cached
  embeddings; `kickIndexer` debounces a burst into one pass; `stopIndexer`
  halts mid-queue and `resumeIndexer` restarts; `kickIndexer` no-ops while
  suspended; a mid-pass kick sets `rekickRequested` and triggers exactly one
  re-query; a throwing photo is skipped without aborting the pass.
- **`photoRepository.test.ts`**: `findReadyPhotosWithoutEmbeddings` excludes
  already-embedded rows, non-ready rows, and excluded folders. Follow the
  existing fake-DB pattern in that file.
- **`aiScanService.test.ts`**: `runFullAiScan` stops the indexer before
  starting and resumes it in `finally`, including on the throw path.
- **`scanHandlers.test.ts`**: a completed scan kicks the indexer.
- **`photoLibraryReducer.test.ts`**: the new action sets and clears progress.
- **`SearchSpotlight.test.tsx`**: live indexing line renders while progress is
  non-null; static shortfall line renders when idle.

## Verification

`npm run precommit` (lint, typecheck, format, full suite with coverage).

Then a manual check, since the whole point is background behavior: launch with
AI enabled and an unindexed backlog, confirm the toast appears unprompted
within a few seconds of startup, the count climbs, the SearchSpotlight line
tracks it, and both clear on completion. Confirm triggering a full AI scan
mid-index suspends cleanly and the indexer resumes afterward without
double-processing.
