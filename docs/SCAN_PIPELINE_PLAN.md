# Scan pipeline rework — first-time folder add

## Context

Adding a folder for the first time crashes the app on a large library. The main-process scan is
not the problem; the crash is in how scan results are streamed into React state, and a secondary
jank problem comes from un-batched synchronous SQLite on the Electron main process.

The goal is to move photo import onto the same background-scan pattern `aiScanService` and
`faceScanService` already use: **counter-only progress, throttled at the source, results committed
in bulk**, with heavy work off the main process.

> **Baseline:** re-verified against branch `v0.9.0` (v0.9.1-beta). The original draft was written
> against `main` @ f0284f4 (v0.8.0-beta); faceted + semantic search and the two background
> indexers (`embeddingIndexService`, `faceIndexService`) have landed since, and materially change
> Phase 4. Line numbers below are current as of this revision.

### Root cause — the renderer pipeline is quadratic

`scanHandlers.ts` flushes a batch whenever it reaches `BATCH_SIZE = 30` records **or**
`BATCH_INTERVAL_MS = 120`, and `flush()` is also called inline after every single ingest. Each
photo produces **two** events (metadata, then thumbnail). A 50k-photo first-time add therefore
emits ~3,300 batches carrying full `PhotoRecord` payloads.

Every batch hits `METADATA_BATCH` in `photoLibraryReducer.ts`, which clones three Maps before
touching anything:

```ts
const photosByPath = new Map(state.photosByPath) // O(n) — every batch
const folderCounts = new Map(state.folderCounts)
const folderChildren = new Map(state.folderChildren)
```

The fresh `photosByPath` identity then invalidates the whole derived chain in
`PhotoLibraryContext.tsx`, each of which re-scans the entire library on the renderer's main thread:

| Derived value                     | Line       | Work per batch                |
| --------------------------------- | ---------- | ----------------------------- |
| `activePhotosByPath`              | 1513       | O(n) rebuild                  |
| `rawTagAggregates`                | 1540       | O(n × tags)                   |
| `tagViewCounts`                   | 1593       | O(n × tags)                   |
| `untaggedCount`                   | 1603       | O(n)                          |
| `photos`                          | 980        | **O(n log n) — full re-sort** |
| `visiblePhotos`                   | 1434       | O(n) filter chain             |
| `selectedPhoto`, `openTabEntries` | 1653, 1819 | O(tabs)                       |

Simulating the current flush cadence against that chain:

```
N=  5000  batches=  334  map_clone_writes=   0.8M  derived_visits=   4.2M  sort_ops=    9.7M
N= 20000  batches= 1334  map_clone_writes=  13.3M  derived_visits=  66.8M  sort_ops=  181.2M
N= 50000  batches= 3334  map_clone_writes=  83.3M  derived_visits= 417.0M  sort_ops= 1241.6M
N=100000  batches= 6667  map_clone_writes= 333.3M  derived_visits=1667.1M  sort_ops= 5297.5M
```

These figures are **simulated from the code**, not measured against a real library — see
"Verification" for how to get a real baseline before starting.

At 50k photos that is ~83M Map insertions of pure garbage plus ~1.2B sort comparisons, delivered
in 3,300 bursts. That is the out-of-memory crash. It is specifically a _first-time_ add because a
rescan hits the SQLite cache in `ingestMetadata`, short-circuits the exiftool read and thumbnail
generation, and finishes before the quadratic term becomes visible.

The existing memoization in `PhotoLibraryContext` (the `tagAggregatesEqual` stabilization, the
random-order guard, the adjust-state-during-render pattern) is correct and should be preserved. It
cannot help here: during a scan the input genuinely changes every time, so every stabilizer pays
full price and then publishes a change anyway.

### Secondary — synchronous SQLite on the main process

`photoIngest.ts` does a `findByPath` and an `upsertPhoto` per photo, and `photoRepository.ts`
issues these as un-transacted `better-sqlite3` calls, which are **synchronous**.
`renamePhotoPathPrefix` and `pruneMissing` already use `db.transaction(...)`; the scan hot path
does not. A 50k first-time add is ~100k synchronous SQLite round-trips blocking the process that
also serves IPC, window events, and the `photag-thumb://` protocol.

`exiftool` (`maxProcs: 4`) and `sharp` (libuv threadpool) are already off-thread and are not
implicated.

## Key decisions

1. **Progress events carry counters only, never payloads.** `scan:progress` becomes
   `{ scanId, phase, done, total }` and is throttled to ~150 ms at the source, matching
   `faceDetection.ts`'s `PROGRESS_INTERVAL_MS`. This is the single change that stops the dashboard
   re-rendering during a scan, because nothing it subscribes to changes any more.

2. **Copy-on-write moves from per-batch to per-commit — the reducer stays immutable at its
   publish boundary.** This distinction is the whole of Phase 2 and is easy to get wrong. See the
   explicit contract in Phase 2; do not "mutate state in place."

3. **`folderTree.ts` is not changed.** `addPhotoToFolderTree`/`removePhotoFromFolderTree` already
   mutate the Maps they're handed and document that callers own copy-on-write (`folderTree.ts:28`).
   That is the correct design; Phase 2 only changes _where_ the caller's copy boundary sits.

4. **Commit folder-at-a-time rather than every 30 records.** A folder is a natural boundary, it
   matches the existing folder tree, and it bounds commit count to the folder count instead of
   N/30. Large single folders still need a record cap so one 40k-photo folder isn't a single
   40k-record commit.

5. **Thumbnail generation leaves the scan's critical path and becomes on-demand.**
   `thumbProtocol.ts` already regenerates a missing thumbnail on request — written as an
   Import-Database repair path, but functionally the lazy generation we want. `thumbnailKeyFor()`
   derives purely from path + mtime + size, so a photo's key is known without decoding the image.
   Persisting the key at metadata time with status `pending` makes on-demand generation reachable
   and halves scan events from 2N to N.

6. **`thumbnailStatus = 'ready'` is now a work-queue gate for two background indexers, not just a
   read filter — this is what makes Phase 4 dangerous.** As of v0.9.x there are **five** query
   sites, not three:

   | Site                     | Query                              | Role                             |
   | ------------------------ | ---------------------------------- | -------------------------------- |
   | `photoRepository.ts:144` | tag exemplars                      | read filter                      |
   | `:173`                   | all ready photos                   | read filter                      |
   | `:192`                   | `findReadyPhotosWithoutEmbeddings` | **embedding indexer work queue** |
   | `:211`                   | `findReadyPhotosWithoutFaceScan`   | **face indexer work queue**      |
   | `:242`                   | throwback (has `dateTaken`)        | read filter                      |

   All five correctly exclude a `pending` row. That exclusion was harmless when these were read
   paths driven by an explicit AI scan. It is **not** harmless now: `runScan` ends by calling
   `kickIndexer()` and `kickFaceIndexer()` (`scanHandlers.ts:195-196`), and those indexers query
   these tables to decide what work exists. If Phase 4 leaves photos at `pending`, both indexers
   kick, find zero rows, and silently no-op — semantic search and face detection would only ever
   cover photos the user happened to scroll past. See Phase 4 for the required fix.

7. **Live streaming is kept where it is cheap.** Watcher events (`PHOTO_UPSERTED`,
   `PHOTO_REMOVED`), rescans, and small folder adds keep today's progressive behaviour. Only scans
   above a threshold switch to counter-only progress + folder-at-a-time commits.

8. **Search adds no renderer derived-state pressure.** `usePhotoSearch` resolves everything
   through IPC round-trips to the main process (`searchQuery.ts` is shared so both sides parse
   identically). It does not subscribe to `photosByPath`, so Phases 1-2 do not need to account
   for it.

9. **The scan worker cannot import the repository.** `better-sqlite3` connections do not cross
   thread boundaries. A scan worker must post results back to the main thread for DB writes, or
   open its own connection — which risks lock contention against the main connection. The existing
   face/tag-suggestion workers never touch the DB, so their protocol is a template for _structure_
   only, not for data access. This is why Phase 5 is last.

## Phases

Ordered by dependency. **Phases 1–3 remove the crash and the main-process jank and carry no UX
tradeoff.** Phases 4–5 are the architectural follow-through.

**Status: Phases 1–3 implemented and merged into the working tree** (typecheck, lint, and the full
test suite — 923 tests — pass). Phase 2 shipped in a revised form; see its section below for why.
Phases 4–5 are not started.

Per `docs/CLAUDE.md`: keep inline comments to two lines or less, prefer Mantine components and
props over custom CSS, and check in before starting rather than running straight through.

---

### Phase 1 — Decouple progress from data ✅ Implemented

**Files:** `src/shared/types.ts`, `src/main/ipc/scanHandlers.ts`, `src/preload/index.ts`,
`src/renderer/src/state/PhotoLibraryContext.tsx`, `src/renderer/src/state/photoLibraryReducer.ts`,
`src/renderer/src/state/PhotoLibraryScanProgressContext.ts`,
`src/renderer/src/state/PhotoLibraryGalleryContext.ts`

**Risk:** low · **No UX tradeoff**

**As implemented, one addition beyond the plan below:** `DashboardView.tsx` and `GalleryGrid.tsx`
both render the scanning indicator unconditionally inside a `memo`'d/large component. Calling
`useScanProgress()` directly in either would re-subscribe that _whole_ component to every ~150ms
tick for the entire scan — including the vast majority of a scan where photos already exist and
the indicator branch never renders — reintroducing the exact "hammering DOM rerenders" complaint
this project exists to fix, just from new code. Fixed by extracting a `PhotoScanProgressIndicator`
leaf component (`src/renderer/src/components/Shared/PhotoScanProgressIndicator.tsx`) that owns the
`useScanProgress()` subscription itself; `DashboardView`/`GalleryGrid` mount it but never subscribe
to progress themselves, so a tick re-renders only the small mounted indicator.

Change the progress event from a one-shot file count to a throttled running counter:

```ts
// src/shared/types.ts — replaces the current { scanId, filesFound }
export type ScanPhase = 'enumerating' | 'reading' | 'finalizing'

export interface ScanProgressEvent {
  scanId: string
  phase: ScanPhase
  done: number
  total: number
}
```

In `scanHandlers.ts`, emit this on a ~150 ms throttle (copy the shape from `faceDetection.ts:40`
— compare `Date.now()` against a `lastProgressAt`, and always emit a final call so the bar reaches
100%). Keep `filesFound` reachable as `total` so nothing downstream loses information.

**Route it through `PhotoLibraryScanProgressContext`, not `galleryState`.** That context landed in
v0.9.x and already carries `aiScanProgress`, `embeddingIndexProgress`, `faceScanProgress`, and
`faceIndexProgress` — all with the same `{ done, total }` shape proposed here. Adding
`photoScanProgress` to it is the natural home and keeps high-churn progress out of the gallery
context, which is exactly the split that context was created to make. Remove `filesFound` from
`galleryState` as part of this.

`ScanProgressIndicator` needs **no change** — it already accepts `percent: number | null`. It is
currently passed a hardcoded `percent={null}` at `DashboardView.tsx:131` and `GalleryGrid.tsx:442`;
feed those real values from `done / total`. `StartupLoadingScreen.tsx` and `DuplicatesView.tsx:285`
also render it and should be checked for consistency.

The reducer's `SCAN_PROGRESS` case already early-returns when the value is unchanged
(`photoLibraryReducer.ts:461`) — preserve that bail-out against the new fields.

**Note:** `scanHandlers.test.ts` pins the current event contract. Update it deliberately to assert
the new shape _and_ the throttling behaviour. Do not simply relax the assertions until they pass.

---

### Phase 2 — Bound the dispatch count, not the clone strategy ✅ Implemented (revised)

**Files (as implemented):** `src/main/ipc/scanHandlers.ts` (constants only) —
**not** `photoLibraryReducer.ts`.

**Risk:** low · **This is the change that removes the O(N²) term**

> **Correction found during implementation.** This phase originally targeted
> `photoLibraryReducer.ts`, on the assumption that `METADATA_BATCH` cloned its three Maps once
> per photo. It doesn't — it already clones exactly once per _dispatched action_, and the
> `photosByPath.has()` dedup guard already checks the in-progress copy correctly, including
> within a single action carrying duplicate paths (verified with a passing test, see below). There
> was nothing to fix in the reducer.
>
> The real lever is dispatch **frequency**, which the reducer has no control over — it's set by
> `scanHandlers.ts`'s `BATCH_SIZE`/`BATCH_INTERVAL_MS`. At the old `BATCH_SIZE = 30`, a 50k-photo
> scan dispatched ~1,667 `METADATA_BATCH` actions (2× that counting thumbnail-triggered flushes),
> each cloning a photosByPath Map whose size was, on average, half the library — that product is
> the quadratic term.
>
> A renderer-side coalescing buffer (debounce multiple wire batches into one dispatch, mirroring
> this same file's `scheduleWatchNotification` pattern) was considered and rejected: many existing
> `PhotoLibraryContext.test.tsx` tests call `subscriptions.onMetadataBatch(...)` once and assert on
> `result.current.photos` in the same `act()`, with no fake timers — a debounce would silently stop
> applying those batches within the test's synchronous assertion, requiring a wide, riskier test
> rewrite for a "low risk" phase.

**What actually ships:** raise `BATCH_SIZE` (30 → 500) and `BATCH_INTERVAL_MS` (120 → 200) in
`scanHandlers.ts`. This cuts dispatch count by ~15–16x with a two-constant change, zero API
changes, and zero test rewrites outside `scanHandlers.test.ts`'s own progress-shape assertions
(already being touched in Phase 1). It does not change the _asymptotic_ complexity — total clone
cost is still O(N²/batchSize) — but at realistic library sizes (tens of thousands of photos, not
millions) this bounds the real-world cost to a small constant. Phase 4's folder-at-a-time commits
is still the path to a true O(N) (or O(folders)) bound; this phase is the low-risk interim fix.

**Why Phase 1 had to land alongside this, not after:** with `BATCH_SIZE` raised, `photosByPath.size`
now jumps by ~500 every ~200ms instead of climbing smoothly — a visibly jerkier progress bar if
anything still derived "done" from map size. Phase 1's separate, main-process-owned counter (ticked
per-file, not per-wire-batch) is what keeps the progress bar smooth despite the chunkier commits.

A regression test was added in `photoRepository`/`photoIngest`/`scanHandlers` test files, but the
originally-proposed reducer-level "N photos ⇒ O(folders) commits" guard was **not** added — it
would currently fail (dispatch count is O(N/batchSize), not O(folders)) until Phase 4 lands. Don't
add that specific assertion before then.

---

### Phase 3 — Batch the database writes ✅ Implemented

**Files:** `src/main/db/photoRepository.ts`, `src/main/services/photoIngest.ts`,
`src/main/ipc/scanHandlers.ts`

**Risk:** low · **Fixes the main-process jank**

Shipped as planned, two changes:

1. **`upsertPhotosBatch()`** wraps many upserts in one `db.transaction()`. `scanHandlers.ts`
   collects newly-ingested/changed records into a buffer (`WRITE_BATCH_SIZE = 500`) instead of
   writing each one inline, force-flushing before `kickIndexer()`/`kickFaceIndexer()` — both query
   the photos table directly on scan completion, so a still-buffered row would be invisible to
   them and silently skip that scan's indexing pass.

2. **`findManyByPathPrefix()`** replaces the per-file `findByPath` call with one `LIKE`-prefix
   query per root, matching `pruneMissing`'s existing precedent (chunked by root, not a single
   `IN (...)` — avoids the 999-variable `SQLITE_MAX_VARIABLE_NUMBER` limit as planned).

`ingestMetadata` gained two options: `prefetched` (the looked-up cache entry, or explicit `null`
for "not found" — distinguished from the key being _absent_, which still means "look it up
yourself") and `deferredWrite` (called instead of an inline `upsertPhoto` on a cache miss). Both
default to today's exact behavior when omitted, so `ingestFile`'s single-file callers (watcher,
tag rewrites, rotate/rename) are unchanged and untested-for-regression — confirmed by grep, none
of `watchManager.ts`/`photoHandlers.ts`/`tagHandlers.ts` pass either option.

---

### Phase 4 — Adaptive commits and lazy thumbnails

**Files:** `src/main/ipc/scanHandlers.ts`, `src/main/services/photoIngest.ts`,
`src/main/protocols/thumbProtocol.ts`, `src/main/db/photoRepository.ts`,
`src/main/db/database.ts`

**Risk:** medium · **2N → N scan events**

Two coupled changes.

**Adaptive commits.** Below a threshold (start at ~2,000 files; it will need tuning), keep today's
live streaming — the progressive fill is good and cheap there. Above it, switch to counter-only
progress with folder-at-a-time commits, capped at ~1,000 records per commit so a single huge
folder doesn't become one enormous commit.

**Lazy thumbnails.** Compute `thumbnailKeyFor(path, mtimeMs, size)` during metadata ingest, persist
it with `thumbnailStatus = 'pending'`, and drop the eager `ingestThumbnail` pass from `runScan`.
`thumbProtocol.ts` then generates on first request via its existing regenerate-on-miss branch
(`thumbProtocol.ts:32-39`).

**Required companion change — do not skip (see Key decision 6).** Making thumbnails lazy starves
both background indexers. `runScan` ends by calling `kickIndexer()` and `kickFaceIndexer()`; those
query `findReadyPhotosWithoutEmbeddings` (`photoRepository.ts:192`) and
`findReadyPhotosWithoutFaceScan` (`:211`), both of which filter on `thumbnailStatus = 'ready'`.
Leave photos at `pending` and both find zero rows and silently do nothing — semantic search and
face detection quietly stop covering the library.

Fix: change those **two work-queue queries** (not the three read filters) to gate on
`thumbnailKey IS NOT NULL` alone, dropping the `thumbnailStatus = 'ready'` term. Both consumers
already tolerate a missing thumbnail file:

- `getOrComputeEmbedding` (`photoEmbedding.ts:17-25`) checks for the thumbnail and calls
  `generateThumbnail` itself when it is absent.
- `faceIndexService` calls `detectFacesInImage(filePath)` on the **original file**, not the
  thumbnail — it never needed the thumbnail at all, only the "successfully ingested" signal that
  `ready` was standing in for.

This also means the indexers become the de-facto thumbnail warm-up pass, which is a reasonable
outcome but worth being deliberate about: they will generate thumbnails in the background after a
scan rather than the scan doing it inline.

Two more details to get right:

- `thumbProtocol`'s handler resolves the photo via `findByThumbnailKey`. That lookup works for a
  `pending` row, so no query change is needed — but confirm the handler updates
  `thumbnailStatus` to `'ready'` after a successful generation, which it does not currently do
  (it was written for rows already marked ready).
- Add a concurrency guard so a fast scroll through an un-thumbnailed gallery doesn't spawn
  hundreds of concurrent `sharp` operations. `p-limit` is already a dependency.
- Consider whether this warrants a `THUMBNAIL_GENERATION` bump in `database.ts:191`. It probably
  does **not** — the key derivation is unchanged, so existing cached thumbnails stay valid.

A low-priority background sweep to pre-generate thumbnails after a scan completes is a reasonable
follow-on, but is not required for correctness and should not block this phase.

---

### Phase 5 — Move enumeration and ingest into a worker

**Files:** new `src/main/workers/scanWorker.ts` + `scanProtocol.ts`,
`src/main/services/directoryScanner.ts`, `src/main/ipc/scanHandlers.ts`

**Risk:** medium · **Do only after 1–4**

Mirror the existing worker protocol under `src/main/workers/` — `faceDetectionProtocol.ts` and
`tagSuggestionProtocol.ts` are the structural templates, along with `pendingRequests.ts`.

**The constraint that shapes this phase (see Key decision 9):** the worker cannot import
`photoRepository`. `better-sqlite3` connections are not transferable across threads. The worker
should crawl and read metadata, then post plain records back to the main thread, which owns all DB
writes via the Phase 3 batching. Do not attempt to open a second connection in the worker without
first establishing how it interacts with the main connection's locking.

This completes parity with the AI scanners but is not where the crash lives — it is worth doing on
its own merits, not as part of the fix.

## Verification

- **Get a real baseline first.** Generate a synthetic library (~50k images) and time a cold add
  against a warm rescan. The gap between them is the entire bug, and the simulated figures above
  should not be treated as measurements.
- **Watch peak renderer RSS, not just wall-clock.** The failure mode is allocation churn — a
  faster scan that still allocates per batch has not been fixed.
- **Count commits, not milliseconds.** The durable regression guard is "N photos ⇒ O(folders)
  commits," per Phase 2.
- **Existing coverage to respect:** `scanHandlers.test.ts` (event contract — Phases 1 and 4),
  `photoLibraryReducer.test.ts` (Phase 2), `photoRepository.test.ts` and `photoIngest.test.ts`
  (Phase 3). These pin real behaviour; update them deliberately rather than relaxing them.
- **Preserve the indexer kicks.** Phases 1, 4, and 5 all restructure `runScan`. It must keep
  calling `kickIndexer()` and `kickFaceIndexer()` on completion (`scanHandlers.ts:195-196`) —
  nothing else triggers embedding or face indexing outside an explicit scan, so dropping them
  silently disables semantic search and People for newly-added photos.
- **Check the `backgroundIndexLane` interaction.** The indexers take turns via a shared lane
  mutex, but that lane knows nothing about the scan itself. Under Phase 4, thumbnail generation
  moves into gallery scroll and indexer passes — verify a large scan followed by an immediate
  indexer kick does not saturate `sharp` from both directions at once. `p-limit` is already a
  dependency if a cap is needed.
- Run `npm run typecheck` (main + renderer) and `npm run lint` before considering a phase done.
