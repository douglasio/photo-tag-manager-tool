# Tag Me — Implementation Plan (reconstructed)

> No plan document or commit history existed in this repo when this was written
> (2026-07-11). This file was reverse-engineered from the current source tree
> to reconstruct the architecture and likely next steps for a resumed session.
> Verify against your own memory of the original plan and correct as needed.

## What it is

"Tag Me" — an Electron + React + TypeScript desktop app for browsing photo
metadata/keyword tags across a chosen folder. Per `package.json`: _"a
folder-based photo organizer for reading and browsing photo metadata tags."_
Current implementation is read-only (browse existing EXIF/IPTC tags), not a
tag editor.

## Stack

- Electron (main/preload/renderer split via `electron-vite`)
- React 19 + TypeScript, Context+reducer for state (no Redux/Zustand)
- `better-sqlite3` — local cache DB (`photag.db` in userData)
- `exiftool-vendored` — reads EXIF/IPTC metadata & keywords
- `sharp` — thumbnail generation
- `fdir` — fast recursive directory walk
- `p-limit` — concurrency control for scan pipeline
- `react-window` — virtualized gallery grid

## Architecture as built

**Main process** ([src/main/index.ts](src/main/index.ts))

- Registers two custom privileged protocols instead of using `file://` directly:
  - `photag-file://` ([fileProtocol.ts](src/main/protocols/fileProtocol.ts)) — serves full-res originals
  - `photag-thumb://` ([thumbProtocol.ts](src/main/protocols/thumbProtocol.ts)) — serves generated thumbnails by hash key
- IPC handlers:
  - `dialog:selectFolder` ([dialogHandlers.ts](src/main/ipc/dialogHandlers.ts))
  - `scan:start` / `scan:cancel` ([scanHandlers.ts](src/main/ipc/scanHandlers.ts))

**Scan pipeline** ([scanHandlers.ts](src/main/ipc/scanHandlers.ts))

1. `scanDirectory` walks the folder for `.jpg/.jpeg/.png/.tif/.tiff`
2. Sends `scan:progress` with total file count
3. For each file (6-way concurrent): check SQLite cache by `mtimeMs`+`sizeBytes`;
   if unchanged, reuse cached record; otherwise re-read EXIF via exiftool and
   upsert
4. If no ready thumbnail, generate one (4-way concurrent), keyed by
   `sha1(path:mtime:size)`
5. Batches results (30 items or every 120ms) and emits `scan:metadata-batch`
   to avoid flooding the renderer
6. On completion, prunes DB rows/thumbnails for files no longer present under
   the root (`pruneMissing`), then emits `scan:complete` with counts/errors

**Renderer** ([App.tsx](src/renderer/src/App.tsx))

- `PhotoLibraryProvider` (Context+reducer) owns scan state and the
  `photosByPath` map, subscribes to the three scan IPC events
- `GalleryGrid` — virtualized grid (react-window) of `PhotoThumbnail` cells
- `DetailPanel` — shows metadata + `TagList` (read-only chip list) for the
  selected photo
- `ScanProgressBar` — scanning/complete/canceled status + cancel button

## Status: what's done vs. missing

**Done:** folder selection, recursive scan with progress, EXIF metadata
extraction, keyword/subject tag reading, thumbnail generation & caching,
mtime-based re-scan caching, stale-file pruning, virtualized gallery,
detail view, cancelable scans.

**Not yet implemented** (gaps visible in the code):

- **Tag editing** — `TagList` only renders tags, there's no add/remove UI, no
  IPC handler to write tags back to files (exiftool supports writes) or to
  the DB. This is the most obvious missing piece given the app's name/purpose.
- **Search / filter by tag or filename** — no search box anywhere in the UI.
- **Multi-select / batch tagging** — `selectedPath` is single-select only.
- **`scanError` field is dead code** — defined on `PhotoRecord` and always set
  to `null`; per-file scan errors are only surfaced in the aggregate
  `ScanCompleteEvent.errors` array, never attached to the record or shown in
  the gallery.
- **No tests** — no test framework is configured in `package.json`.
- **No app icon/menu customization beyond boilerplate**, no settings/about UI.
- **No git commits yet** — working tree is fully untracked.

## Suggested next steps (unconfirmed — pick based on actual intent)

1. Decide if tag _editing_ is in scope for v1, or if this stays a read-only
   browser (name suggests editing was intended).
2. If editing: add `tag:add` / `tag:remove` IPC handlers, write through
   exiftool to the file's `Keywords`/`Subject` fields, then update the DB row
   and dispatch a renderer state update.
3. Add tag/filename search & filter in `GalleryGrid`.
4. Surface per-file scan errors in the UI (thumbnail shows `⚠︎` already; wire
   `scanError` through or drop the field).
5. Set up a test framework and an initial commit / git history.
