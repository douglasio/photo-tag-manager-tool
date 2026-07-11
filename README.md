# Tag Me

A folder-based photo organizer for reading and browsing photo metadata tags.
Point it at a folder, and it recursively scans for JPEG/PNG/TIFF images,
reads their EXIF/IPTC keyword tags and camera metadata, generates
thumbnails, and displays everything in a fast, virtualized gallery.

Built with Electron, React, and TypeScript.

## Features

- Recursive folder scan for `.jpg` / `.jpeg` / `.png` / `.tif` / `.tiff`
- Reads EXIF/IPTC metadata (keywords, camera make/model, dimensions, date
  taken) via `exiftool-vendored`
- Generates and caches thumbnails on disk
- SQLite-backed cache keyed by file path + modified time/size, so re-scanning
  an unchanged folder is instant and avoids re-reading EXIF or regenerating
  thumbnails
- Automatically prunes cache entries and thumbnails for files that have been
  moved or deleted since the last scan
- Virtualized gallery grid (handles large photo libraries without choking
  the renderer)
- Cancelable scans with live progress

## Architecture

The app follows Electron's standard three-process split, wired together with
`electron-vite`.

### Main process (`src/main`)

- **`index.ts`** — app entry point; creates the `BrowserWindow` and registers
  protocols/IPC handlers on startup.
- **`services/directoryScanner.ts`** — recursively walks a folder (via
  [`fdir`](https://github.com/thecodrr/fdir)) and returns matching image
  paths.
- **`services/metadataService.ts`** — wraps a long-lived `exiftool-vendored`
  process pool to read EXIF/IPTC tags per file. `Keywords` and `Subject`
  fields are merged and deduplicated into a single `tags` array.
- **`services/thumbnailService.ts`** — generates a 300px-long-edge JPEG
  thumbnail per photo via [`sharp`](https://sharp.pixelplumbing.com/),
  cached on disk under the app's `userData/thumbnails` directory. Thumbnail
  filenames are a SHA-1 hash of `path:mtime:size`, so a modified file
  naturally gets a new thumbnail instead of serving a stale cached one.
- **`db/database.ts`** / **`db/photoRepository.ts`** — a single SQLite table
  (`better-sqlite3`) keyed by absolute file path, storing tags, metadata,
  thumbnail status, and the `mtime`/size pair used to decide whether a file
  needs to be re-read on the next scan.
- **`ipc/scanHandlers.ts`** — orchestrates a scan: walks the directory, then
  processes files concurrently (`p-limit` caps metadata reads at 6 and
  thumbnail generation at 4 in flight), diffing against the SQLite cache so
  unchanged files skip both exiftool and sharp entirely. Results are batched
  (every 30 photos or 120ms, whichever comes first) before being pushed to
  the renderer over IPC, to avoid flooding it with thousands of individual
  events on a large library. After the scan, any cached entries whose files
  are no longer present are pruned along with their thumbnails.
- **`ipc/dialogHandlers.ts`** — native folder-picker dialog.
- **`protocols/fileProtocol.ts`** / **`protocols/thumbProtocol.ts`** —
  register two custom, privileged protocols (`photag-file://`,
  `photag-thumb://`) so the renderer can request full-resolution originals
  and cached thumbnails by path/hash without needing Node/filesystem access
  itself.

### Preload (`src/preload`)

Exposes a small typed `window.api` surface (folder picking, starting/
canceling scans, subscribing to scan progress/metadata/completion events) to
the renderer via `contextBridge`, keeping the renderer sandboxed from direct
Node/IPC access.

### Renderer (`src/renderer/src`)

- **`state/photoLibraryReducer.ts`** + **`state/PhotoLibraryContext.tsx`** —
  a single `useReducer`-based store (no external state library) tracking
  scan status, the in-progress photo map, and the selected photo. Subscribes
  to the three scan IPC events pushed from the main process.
- **`components/GalleryGrid.tsx`** — virtualized grid (via `react-window`)
  that lays out `PhotoThumbnail` cells based on available width, so
  rendering cost stays flat regardless of library size.
- **`components/PhotoThumbnail.tsx`** — a single grid cell; requests its
  image over the `photag-thumb://` protocol.
- **`components/DetailPanel.tsx`** / **`components/TagList.tsx`** —
  metadata and tag display for the currently selected photo.
- **`components/FolderPicker.tsx`** / **`components/ScanProgressBar.tsx`** —
  scan controls and live progress/status.

### Shared (`src/shared`)

Types and helpers shared between main and renderer (`PhotoRecord`, scan
event payloads, and the custom protocol URL builders).

## Development

```bash
npm install
npm run dev
```

Other useful scripts:

```bash
npm run typecheck   # TypeScript, main + renderer
npm run lint         # ESLint
npm run format       # Prettier
```

## Building

```bash
npm run build:mac    # or build:win / build:linux
```

Packaged output goes to `dist/`. Icons and platform build resources live in
`build/` and `resources/`.

## License

[MIT](LICENSE)
