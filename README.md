# Tag Me

A photo organizer for reading and browsing photo metadata tags. Details about your photos stay where they belong - on the photo files themselves, not locked into a particular application or ecosystem.

No cloud features, no telemetry, just your photos on your computer: organized, tagged, sorted, and more.

Point it at a folder, and it recursively scans for JPEG/PNG/TIFF images, reads their EXIF/IPTC keyword tags and camera metadata, generates thumbnails, and displays everything in a fast, virtualized gallery. Folders are watched live, so new or changed photos show up automatically without a manual rescan.

Built with Electron, React, and TypeScript.

## Download

[![Latest release](https://img.shields.io/github/v/release/douglasio/photo-tag-manager-tool?label=latest%20release)](https://github.com/douglasio/photo-tag-manager-tool/releases/latest)

Prebuilt installers for macOS, Windows, and Linux are attached to each
[release](https://github.com/douglasio/photo-tag-manager-tool/releases/latest) —
no need to build from source. Grab the one for your platform:

- **macOS** — `.dmg` (unsigned; right-click → Open the first time to bypass
  Gatekeeper, since there's no Apple Developer certificate yet)
- **Windows** — `.exe` installer
- **Linux** — `.AppImage`, `.deb`, or Snap

## Features

### Library & tags

- Recursive folder scan for `.jpg` / `.jpeg` / `.png` / `.tif` / `.tiff`, with live folder watching for new/changed/removed files
- Reads and writes EXIF/IPTC keyword tags directly on the file — tags travel with the photo, no proprietary database lock-in
- Tag groups (organize related tags together, with optional auto-add match rules) and per-tag descriptions
- Exclude specific folders or filename patterns from scanning, or from being counted in AI/aggregate features
- Rename, rotate (lossless), delete, and comment on photos; per-photo view counts
- Instant re-scans via a SQLite-backed cache — unchanged files skip re-reading EXIF and regenerating thumbnails entirely

### Gallery

- Fast, virtualized grid and list views that stay smooth on very large libraries
- Folder tree, tag panel, and People panel for browsing/filtering by folder, tag, or person
- Drag-and-drop tagging, multi-select, keyboard navigation, and a hover/spacebar photo preview
- Side-by-side compare view, and a duplicate-photo view for reviewing near-identical shots
- Magazine, newspaper, DVD cover, art gallery, and movie theater visualizations for a selected photo

### People (face detection)

- Opt-in, fully offline face detection and grouping using bundled on-device models — nothing leaves your computer
- Automatically clusters detected faces into people you can name, and filter the gallery by
- Manually merge, split, hide, or reassign a face if a grouping isn't quite right — corrections stick and survive future re-scans
- Cover photos are automatically the best-matching, face-cropped shot for each person

### AI features (opt-in, on-device)

All AI features run locally via small on-device models (downloaded once, cached, never uploaded anywhere):

- **Tag suggestions** — suggests tags for untagged photos based on ones you've already tagged
- **Duplicate detection** — finds near-identical photos across your library
- **Time Warp** — surfaces photos from the same day in past years, like a "on this day" memory feed

### Dashboard

An overview page with widgets for onboarding (get started tagging), a featured tag, tagging progress, top tags, top-viewed photos, recently added photos, a "photos from this year" throwback, and Time Warp.

### Settings

Manage watched folders, exclude patterns/folders, view keyboard shortcuts, and tune general/gallery preferences — including enabling or resetting AI features and face detection.

## How it works

The app follows Electron's standard three-process split (main / preload / renderer), wired together with `electron-vite`:

- **Main process** (`src/main`) owns the filesystem: scanning, EXIF reads/writes (`exiftool-vendored`), thumbnail generation (`sharp`), the SQLite cache (`better-sqlite3`), folder watching, and the on-device AI models (face detection, embeddings, clustering) run in worker threads so they never block the UI.
- **Preload** (`src/preload`) exposes a small typed `window.api` surface over `contextBridge`, keeping the renderer sandboxed from direct Node/filesystem access.
- **Renderer** (`src/renderer/src`) is a React app with a `useReducer`-based store (no external state library), a virtualized gallery (`react-window`), and Mantine for UI. Photos and thumbnails are served to it through two custom, privileged protocols rather than direct file access.
- **Shared** (`src/shared`) holds types and helpers used by both processes.

## Development

```bash
npm install
npm run dev
```

### In a container

A `.devcontainer/` config is included, so you can develop without installing
Node, build tools, or Electron's Linux runtime deps on the host. Open the
folder in VS Code with the **Dev Containers** extension and choose "Reopen in
Container" — it builds the image and runs `npm install` for you.

The window renders on your host X11 display, so it only works if you're on
X11 (not Wayland) — check with `echo $XDG_SESSION_TYPE`. Inside the container
terminal, use `.devcontainer/dev.sh` instead of `npm run dev`: containers
don't have a real GPU device attached, so Chromium's GPU process fails to
initialize unless hardware acceleration is disabled.

Other useful scripts:

```bash
npm run typecheck   # TypeScript, main + renderer
npm run lint         # ESLint
npm run format       # Prettier
npm run test         # Vitest
```

## Building

```bash
npm run build:mac    # or build:win / build:linux
```

Packaged output goes to `dist/`. Icons and platform build resources live in
`build/` and `resources/`.

## License

[MIT](LICENSE)
