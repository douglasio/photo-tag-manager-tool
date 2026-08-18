---
name: ipc-channel
description: >
  Wire a new main <-> renderer IPC channel in this Electron app. Use this skill when: (1) adding
  a new invoke/handle call (renderer asks main to do something and wants a result), (2) adding a
  new main-to-renderer push event (e.g. scan progress, watcher updates), (3) touching
  src/main/ipc/*, src/preload/index.ts, or src/shared/types.ts together, or (4) any task that
  needs a value or action to cross the process boundary.
---

# IPC Channel Skill

This app is a strict 3-process Electron split: **main** owns the filesystem/DB/AI workers,
**renderer** is a sandboxed React app, **preload** is the only bridge between them. There is no
direct Node access from the renderer — every capability crosses through a hand-typed
`window.api` surface.

## The four files a channel touches

1. `src/shared/types.ts` — shared payload/result types, if the channel needs new ones.
2. `src/main/ipc/<domain>Handlers.ts` — the `ipcMain.handle(...)` implementation.
3. `src/preload/index.ts` — one line in the `api` object exposing it via `ipcRenderer.invoke`.
4. Renderer call site — usually inside `src/renderer/src/state/PhotoLibraryContext.tsx` or a
   component/hook, calling `window.api.xxx(...)`.

`PhotagApi` (`export type PhotagApi = typeof api`) is inferred from the `api` object itself —
adding a property to `api` in preload is enough to update the type; `preload/index.d.ts` just
declares `window.api: PhotagApi` globally and rarely needs edits.

## Pattern A: request/response (renderer asks, main answers)

**Main handler** — grouped by domain in `src/main/ipc/<domain>Handlers.ts`, one
`register<Domain>Handlers()` function per file, called once from `src/main/index.ts`:

```ts
// src/main/ipc/tagHandlers.ts
ipcMain.handle('tags:setDescription', (_event, tag: string, description: string): void => {
  setTagDescription(tag, description)
})
```

- Channel names are `'<domain>:<action>'` (`photo:rename`, `settings:getFolders`, `ai:rescan`).
- Handlers call into `src/main/db/*Repository.ts` (SQLite) or `src/main/services/*.ts`
  (EXIF, thumbnails, scanning, AI) — they don't own logic themselves, they wire it up.
- If a new handler file is created, register it in `src/main/index.ts` alongside the other
  `register*Handlers()` calls.

**Preload** — add one arrow function to the `api` object, typed with the real shared types
(not `any`), matching argument order exactly:

```ts
// src/preload/index.ts
setPersonDescription: (id: string, description: string): Promise<void> =>
  ipcRenderer.invoke('faces:setDescription', id, description),
```

**Renderer** — call `window.api.setPersonDescription(id, description)` directly, or from a
dispatched action inside `PhotoLibraryContext.tsx` if it needs to update app state afterward.

## Pattern B: push event (main tells renderer something happened)

Used for scan progress, folder-watch updates, AI/face scan progress — anything main-initiated.

**Emit from main** via a stored `WebContents` reference (see `watchManager.ts`'s
`watchTarget`), not a fresh lookup each time:

```ts
watchTarget?.send('watch:photo-upserted', payload)
```

**Preload** exposes a `subscribe`-wrapped listener, returning an unsubscribe function — every
`on*` method in `api` follows this exact shape:

```ts
onPhotoUpserted: (callback: (payload: WatchPhotoUpsertedEvent) => void): (() => void) =>
  subscribe('watch:photo-upserted', callback),
```

`subscribe<T>` (top of `preload/index.ts`) wraps `ipcRenderer.on`/`removeListener` so every
caller gets automatic cleanup — never call `ipcRenderer.on` directly for a new event.

**Renderer** calls the `on*` method inside a `useEffect`, always cleaning up:

```ts
useEffect(() => window.api.onPhotoUpserted((payload) => { ... }), [])
```

## Conventions to follow

- **Batch mutations use `p-limit`**, not `Promise.all` unbounded — see `tagHandlers.ts`'s
  `TAG_BATCH_CONCURRENCY`. `p-limit` is ESM-only; the CJS main bundle needs the
  `(pLimitImport as unknown as { default?: ... }).default ?? pLimitImport` unwrap already
  present at the top of files that use it — copy that pattern, don't re-derive it.
- **Watcher re-entrancy**: any handler that writes to a file being watched must call
  `suppressNextEvent(filePath)` (from `services/watchManager`) _before_ the write, or the
  watcher's own change-detection will race the handler's own re-ingest.
- **Return the updated record, not void**, for anything the renderer needs to merge into state
  — most photo/tag mutations return `Promise<PhotoRecord>` or `Promise<PhotoRecord[]>` so the
  caller can dispatch it straight into the reducer.
- Partial-failure batch ops (e.g. `deletePhotos`) resolve with only the successful subset rather
  than throwing — document that choice with a short comment, same as the existing one in
  `preload/index.ts` above `deletePhotos`.
- Keep handler bodies thin. Business logic belongs in `src/main/db/*` or `src/main/services/*`;
  a handler is glue, not the place to add new logic.

## Testing a new handler

Main-process IPC tests run under `// @vitest-environment node` and mock every collaborator with
`vi.hoisted` + `vi.mock`, including `electron` itself:

```ts
// @vitest-environment node
const { mockHandle, mockSomeRepoFn } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockSomeRepoFn: vi.fn().mockReturnValue([])
}))
vi.mock('electron', () => ({ ipcMain: { handle: mockHandle } }))
vi.mock('@main/db/someRepository', () => ({ someRepoFn: mockSomeRepoFn }))

import { registerSomeHandlers } from './someHandlers'
```

Then call `registerSomeHandlers()` and invoke the handler captured by `mockHandle.mock.calls`.
See `src/main/ipc/scanHandlers.test.ts` for the full pattern.

## Checklist for a new channel

1. Add shared types to `src/shared/types.ts` if payloads are new.
2. Implement the handler in the right `src/main/ipc/<domain>Handlers.ts` (or create one and
   register it in `src/main/index.ts`).
3. Expose it in `src/preload/index.ts`'s `api` object with full parameter/return types.
4. Call it from the renderer (component, hook, or `PhotoLibraryContext.tsx` action).
5. Add a handler test following the `vi.hoisted`/`vi.mock` pattern above.
6. Run `npm run typecheck` — a mismatched preload signature vs. handler args is the most common
   break, and it's silent until typecheck catches it (`ipcRenderer.invoke` args aren't checked
   against the handler at compile time).
