# Search Plan

Implementation plan for faceted Spotlight search (ROADMAP Shell #3). Companion to `VIDEO_PLAN.md`.

The goal is the thing Picasa had and this app doesn't: a way to find a photo without remembering which folder or tag it's under. A search icon in the app header (and `Cmd/Ctrl + F`) opens a Spotlight covering filenames, comments, tags, people, and folders, with facets to narrow by field — and a "Show all in Gallery" action that turns any query into a browsable grid, which is how Picasa search actually worked.

## The architecture decision: no index

**v1 uses an index-free scan in the main process. No FTS5, no triggers, no backfill, no schema migration.**

This was the review's headline change. The searchable corpus is small: filename + comment + tags + path run ~100–200 bytes per photo, so even 100k photos is ~10–20MB of text. Measured against this project's actual `better-sqlite3` build: at **100k rows, SELECTing every searchable column takes ~44ms and the JS scan takes ~10ms**. At the target library size (≤10k photos, headroom to ~100k) a debounced per-keystroke query costs single-digit milliseconds. An earlier draft of this plan specified an FTS5 virtual table with sync triggers and a backfill migration — that was the plan's riskiest 40% (trigger correctness fails _silently_, leaving a stale index you discover weeks later), spent solving a performance problem this corpus size does not have.

The scan engine is also _functionally better_ at this scale:

- **True substring matching.** `each` finds `beach.jpg`; `234` finds `IMG_1234`. FTS5's tokenizer can only do whole-token and prefix matches (infix needs the trigram tokenizer, with its own tradeoffs).
- **Full Unicode case folding** via JS `toLowerCase()`. SQLite's `LIKE` and `lower()` are ASCII-only without ICU.
- **Zero staleness, by construction.** Every query reads the photos table directly. There is no index to desynchronize, so there is nothing to test for sync rot and no backfill to run.

**Why main process, when the renderer already holds `photosByPath` with tags and comments in memory?** Considered and rejected: main-process search (a) queries the DB as the single source of truth rather than the renderer's session mirror, (b) keeps the scan off the renderer thread where it could jank typing and animations, and (c) hides the engine behind an IPC seam so FTS5 can be swapped in later without touching the parser, UI, or preload. The IPC round trip costs ~1ms.

**Escalation trigger:** if real-library query time exceeds ~50ms, swap the repository internals for standalone FTS5 (see appendix). The parser, AST, IPC contract, and UI — the large majority of the work — are engine-agnostic and unchanged by that swap.

## Query model

`shared/searchQuery.ts` parses input into an AST and serializes it back, so typed flags and UI chips drive the same state — toggling a chip visibly rewrites the input text and vice versa, otherwise the two drift and it reads as broken.

**v1 AST: a flat conjunction of predicates** — `{ field, op, value, negated }[]`. Compound search (ROADMAP Shell #4) later generalizes this to a tree with OR/grouping over the _same_ predicate type; v1's parser output is deliberately the leaf node of that future tree.

Never interpolate user text into any query syntax. The parser is the only thing that reads raw input; malformed input (unbalanced quotes, stray `:`) degrades to literal terms rather than erroring.

### Facets

**Text predicates** (substring/prefix over scanned fields):

| Flag          | Matches                             |
| ------------- | ----------------------------------- |
| `filename:`   | File name                           |
| `comment:`    | `photos.comment`                    |
| `folder:`     | Path segments                       |
| _(bare term)_ | All text fields, including tag text |

**Exact-set predicates** (resolved against known entities, then applied as a path-set constraint — _not_ text matching):

| Flag      | Resolves via                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `tag:`    | Existing `findPhotoPathsWithTag` — tags are a controlled vocabulary; `tag:beach` means _has that tag_, with prefix autocomplete in the UI |
| `person:` | Face assignments (`faces.personId`) joined through people names                                                                           |

Repeated exact-set flags intersect. **`person:joe person:mary before:2020` therefore works in v1** — conjunctive graph-style queries come free; only OR/grouping/natural-language remain for Shell #4.

**Structured predicates** (plain comparisons):

| Flag                                     | Column                       |
| ---------------------------------------- | ---------------------------- |
| `year:2024`, `before:2020`, `after:2015` | `dateTaken`                  |
| `added:`                                 | `firstSeenAt`                |
| `camera:`                                | `cameraMake` / `cameraModel` |
| `views:>5`                               | `viewCount`                  |
| `is:untagged`                            | empty tags                   |
| `has:faces`, `has:comment`               | presence checks              |
| `format:jpeg`                            | `format`                     |

Negation (`-blurry`, `-tag:screenshots`) applies to any predicate.

### Exclusions

Photos in excluded folders are **out by default**, with an "include excluded" toggle — matching the existing choke point (excluded folders are filtered from AI/tag/dashboard aggregates but stay directly browsable).

## Ranking

Simple, documented, tunable — not bm25:

```
score = fieldWeight × matchQuality  (summed over matching fields)
fieldWeight:  filename 3 · tags 2.5 · folder 1.5 · comment 1
matchQuality: exact token 2 · prefix 1.5 · substring 1
tiebreak:     dateTaken DESC (recent first, the Picasa feel)
```

Personal-library queries are 1–3 terms; heuristic ranking at this scale is comparable to bm25 in practice and trivially explainable when a result looks wrong.

## Results UX

- **Entry**: an `ActionIcon` (magnifying glass) in the app header, plus `Cmd/Ctrl + F` via Spotlight's `shortcut="mod + F"` prop. (Electron sets no default Find accelerator, and PhotoView's shortcuts don't use F — verified no conflict.)
- **Spotlight modal** (`@mantine/spotlight`, new dependency): grouped results — Photos (with thumbnails via `Spotlight.Action` children) · Tags · People · Folders — capped at ~5–7 per group. Tags/people/folders are matched renderer-side from state (small in-memory sets; no IPC needed).
- **"Show all N results in Gallery"**: final action in the modal. Applies the query as a gallery filter: the search returns the full matched path list (a 10k-path list is well under 1MB over IPC), the gallery filters `visiblePhotos` by that set, and the active query renders as a dismissible chip beside the existing tag/person filter affordances. Re-runs on library mutations while active.
- Selecting an individual result drives existing actions (`selectPhoto`, `setFolderTagFilter`, `setPersonFilter`) — no new navigation paths.

## Build order

1. **Parser + serializer** (`shared/searchQuery.ts`) — pure, exhaustively tested (quotes, negation, unknown flags, bare `:`, round-trip property tests). The single riskiest-to-get-wrong v1 piece, and fully testable in isolation.
2. **Search repository** (`main/db/searchRepository.ts`) — takes the AST, SELECTs searchable columns, scans with Unicode folding, applies exact-set and structured predicates, ranks, returns `{ paths, total }` plus top-N with score. Exclusion filter here.
3. **IPC + preload** — one `search:query` channel. One channel, not one per facet.
4. **Spotlight UI** (`components/Search/`) — header icon, modal, chips, grouped results.
5. **Gallery filter integration** — search-results mode in gallery state + query chip.

Steps 1–2 land as self-contained, heavily tested commits before any UI. **No schema changes at any step.**

## Testing

- Parser: exhaustive unit + round-trip (parse→serialize→parse) property tests; malformed input must degrade, never throw.
- Repository: in-memory DB tests per predicate type, intersection semantics, exclusion default/override, ranking order.
- A perf smoke test at synthetic 100k rows asserting the query stays under budget, so the escalation trigger is measured rather than vibes.
- UI: existing component-test pattern.

## Risks

- **Debounce + staleness.** Sequence-number each query; renderer drops out-of-order responses. Debounce ~150ms.
- **Tags are stored as a JSON string** (`photos.tags`); the scan matches against parsed tag text, not the raw JSON, so brackets/quotes never affect matching. Exact `tag:` never touches text at all.
- **Ranking tuning** wants a pass against a real library once the UI exists — weights above are starting points.

## Deliberately out of scope for v1

- **Commands** (open Settings, rescan) — held per earlier decision; separate ranking-design problem.
- **Fuzzy/typo matching** — substring matching already covers much of what fuse.js would add; revisit only if real use shows misses.
- **Search history / saved searches** — cheap later via the settings table; noted on roadmap.

## Follow-on: semantic (pixel-content) search

Unchanged from the original plan, and unaffected by the engine change — it sits behind the same repository seam as another result source. Embed query text with the CLIP text encoder already shipped in `tagSuggestionWorker` (`Xenova/clip-vit-base-patch32`), cosine against the cached `photo_embeddings`. Own labeled result group (cosine has no natural cutoff — tuned threshold + top-N), gated on AI features, distinct from person search ("Mom" hits the people index, not CLIP). No content restrictions: CLIP is a local embedding model with no safety classifier or refusal path. Expect broad-gist strength, weakness on fine distinctions/counting/text-in-images/proper nouns.

## Follow-on: compound facet search (Shell #4)

v1's conjunctive AST already covers "photos of Joe and Mary before 2020." What remains:

- **OR and grouping**: generalize the AST from predicate list to expression tree; the scan engine evaluates trees naturally (it's just a JS predicate), which is another quiet advantage over building nested FTS MATCH strings.
- **Facet-count-aware ranking**: photos matching more predicates outrank fewer.
- **Natural-language phrasing** as a separate layer lowering onto the same AST, keeping flag syntax the stable interface.

## Appendix: the FTS5 escalation path

If the ~50ms budget is ever exceeded (roughly >250k photos):

- **Standalone FTS5 table, not external-content.** External-content tables require the `'delete'` special-command with _old_ row values on every UPDATE/DELETE trigger; getting it subtly wrong silently desynchronizes the index. Standalone duplicates ~10–20MB of text and supports ordinary DML, eliminating that failure class. Verified available: FTS5 compiled into this project's `better-sqlite3` (SQLite 3.53.4).
- Sync via three `AFTER INSERT/UPDATE/DELETE` triggers on `photos` (normalizing the tags JSON with `json_each` + `group_concat`), plus a rebuild path for self-healing.
- **Trigram tokenizer** (SQLite ≥3.34, available here) if substring semantics must be preserved; default unicode61 with auto-prefix on the last term otherwise.
- `bm25()` with per-column weights replaces the heuristic ranking.
- Only `searchRepository.ts` internals change; parser, AST, IPC, and UI are untouched.
