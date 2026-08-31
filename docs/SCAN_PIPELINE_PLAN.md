# Scan pipeline rework — first-time folder add

## Context

Adding a folder for the first time crashes the app on a large library. The main-process scan is
not the problem; the crash is in how scan results are streamed into React state, and a secondary
jank problem comes from un-batched synchronous SQLite on the Electron main process.

The goal is to move photo import onto the same background-scan pattern `aiScanService` and
`faceScanService` already use: **counter-only progress, throttled at the source, results committed
in bulk**, with heavy work off the main process.

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
| `selectedPhoto`, `openTabEntries` | 1501, 1667 | O(tabs)                       |

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
   mutate the Maps they're handed and document that callers own copy-on-write (folderTree.ts:28).
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

6. **Persisting a `thumbnailKey` before the file exists is safe — verified, not assumed.** All
   three consumers (`photoRepository.ts:144`, `:173`, `:192`) filter on
   `thumbnailStatus = 'ready' AND thumbnailKey IS NOT NULL`. Because status gates every one, an
   early key with status `pending` is excluded correctly at all three sites. No query changes
   needed.

7. **Live streaming is kept where it is cheap.** Watcher events (`PHOTO_UPSERTED`,
   `PHOTO_REMOVED`), rescans, and small folder adds keep today's progressive behaviour. Only scans
   above a threshold switch to counter-only progress + folder-at-a-time commits.

8. **The scan worker cannot import the repository.** `better-sqlite3` connections do not cross
   thread boundaries. A scan worker must post results back to the main thread for DB writes, or
   open its own connection — which risks lock contention against the main connection. The existing
   face/tag-suggestion workers never touch the DB, so their protocol is a template for _structure_
   only, not for data access. This is why Phase 5 is last.

## Phases

Ordered by dependency. **Phases 1–3 remove the crash and the main-process jank and carry no UX
tradeoff.** Phases 4–5 are the architectural follow-through.

Per `docs/CLAUDE.md`: keep inline comments to two lines or less, prefer Mantine components and
props over custom CSS, and check in before starting rather than running straight through.

---

### Phase 1 — Decouple progress from data

**Files:** `src/shared/types.ts`, `src/main/ipc/scanHandlers.ts`, `src/preload/index.ts`,
`src/renderer/src/state/PhotoLibraryContext.tsx`, `src/renderer/src/state/photoLibraryReducer.ts`

**Risk:** low · **No UX tradeoff**

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

`ScanProgressIndicator` needs **no change** — it already accepts `percent: number | null`. It is
currently passed a hardcoded `percent={null}` at `DashboardView.tsx:119` and `GalleryGrid.tsx:421`;
feed those real values from `done / total`. `StartupLoadingScreen.tsx` and `DuplicatesView.tsx:284`
also render it and should be checked for consistency.

The reducer's `SCAN_PROGRESS` case already early-returns when the value is unchanged
(`photoLibraryReducer.ts:398`) — preserve that bail-out against the new fields.

**Note:** `scanHandlers.test.ts` pins the current event contract. Update it deliberately to assert
the new shape _and_ the throttling behaviour. Do not simply relax the assertions until they pass.

---

### Phase 2 — One Map identity per commit, not per batch

**Files:** `src/renderer/src/state/photoLibraryReducer.ts`, `photoLibraryReducer.test.ts`

**Risk:** low · **This is the change that removes the O(N²) term**

**The contract, stated explicitly — read before writing code:**

> The reducer must still be immutable _at its publish boundary_. It must never mutate a Map that
> is currently referenced by committed state, because `PhotoLibraryContext`'s memo chain and every
> `React.memo` consumer bail out on reference identity. Mutating shared state fails **silently**:
> components stop re-rendering when they should, and nothing throws.
>
> What changes is the _frequency_ of the copy, not its existence. Today: clone three Maps per
> 30-record batch. After: clone once per commit, apply every record from that commit into the
> fresh copies, then publish. Same immutability guarantee, ~1/100th the copies.

Concretely, accept many records in one action rather than accumulating many small actions.
`addPhotoToFolderTree` continues to be called per photo against the freshly-cloned Maps —
unchanged, and still O(depth) per photo.

Preserve the existing `photosByPath.has(photo.filePath)` guard that gates folder-tree insertion
(`photoLibraryReducer.ts:406`). It is what keeps a re-ingested photo from double-counting its
folders, and it must be checked against the _in-progress_ copy, not the pre-commit state, so that
duplicates within a single commit are also deduped.

**Regression guard worth keeping:** assert that a scan of N photos dispatches O(folders) commits
rather than O(N). That is cheap to express in `photoLibraryReducer.test.ts` and will not go stale
the way a timing assertion would.

---

### Phase 3 — Batch the database writes

**Files:** `src/main/db/photoRepository.ts`, `src/main/services/photoIngest.ts`,
`src/main/ipc/scanHandlers.ts`

**Risk:** low · **Fixes the main-process jank**

Two changes:

1. **Wrap upserts in `db.transaction()`** in chunks of ~500. The pattern already exists in this
   file — see `pruneMissing`'s `deleteMany` and `renamePhotoPathPrefix`'s `updateMany`.

2. **Replace the per-photo `findByPath`** with a single bulk prefetch of
   `path → { mtimeMs, sizeBytes, record }` for the roots being scanned, so the cache-hit check in
   `ingestMetadata` becomes an in-memory lookup.

**Trap:** SQLite's default `SQLITE_MAX_VARIABLE_NUMBER` is 999. A naive
`WHERE path IN (...)` over 50k paths will fail. Either chunk the `IN` clause, or prefer a single
`WHERE path LIKE ?` prefix query per root — `pruneMissing:291` already uses exactly that approach
and is the better precedent here.

`ingestMetadata` currently takes a `filePath` and does its own lookup. It will need an optional
pre-fetched cache entry parameter so the bulk path can pass one in, while `ingestFile`'s existing
single-file callers (watcher, tag writes) keep working unchanged. Keep both paths working — the
watcher depends on the single-file behaviour.

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

Two details to get right:

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

**The constraint that shapes this phase (see Key decision 8):** the worker cannot import
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
- Run `npm run typecheck` (main + renderer) and `npm run lint` before considering a phase done.
