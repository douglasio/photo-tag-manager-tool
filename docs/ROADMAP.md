# Roadmap

This document serves as a roadmap of feature to implement, generally in no particular order.

# Bug Fixes

# Features

To-dos, tasks, and features loosely grouped by feature segment.

## Shell

1. Add a message on the opening loading screen if new photos are detected / being imported, to alert users that opening the app may take a little longer.

2. Corrupt photo finder

3. Search -- implement faceted spotlight search using Mantine `Spotlight`. See **SEARCH_PLAN.md** for the full plan (revised after review: **index-free scan engine, no FTS5/triggers/migration in v1** — the corpus is small enough to scan per keystroke, benchmarked at ~50ms even at 100k photos; FTS5 is a documented escalation path behind the same repository seam). Entry: header search icon + `Cmd/Ctrl+F`. Facets: filename/comment/folder as substring text, `tag:`/`person:` as exact set filters, plus date/camera/views/`is:untagged` structured filters — typed flags and UI chips drive the same parsed state. Includes "Show all results in Gallery" (Picasa-style grid filtering), since a 7-row modal is no home for 400 matches. Repeated `person:` flags intersect, so "person:joe person:mary before:2020" already works in v1. Commands and search history deliberately held out.

4. Compound facet search — Graph-search-style composition beyond v1's conjunctions. v1 already handles AND-of-facets ("photos of Joe and Mary before 2020"); what remains is OR/grouping (AST becomes an expression tree — cheap under the scan engine, which evaluates JS predicates rather than building query strings), facet-count-aware ranking, and a natural-language layer that lowers onto the same AST. See SEARCH_PLAN.md's "Compound facet search" section.

5. Initial state -- use Mantine EmptyState to improve the how the app looks before any photos have been added. I think maybe some placeholder elements are warranted to show how the app is meant to look after photos have been added. And we need more features like the Featured Tag onboarding process for other widgets and areas of the app to guide users on how to get things populated.

6. Make all 'Enable AI features' buttons use the gradient variant.

7. Video support?

## Application Management

Making Tag Me feel like a real installable desktop app rather than a dev build.

1. Application MenuBar. Native menus for the actions currently reachable only through in-app UI (add folder, preferences, rescan, view switching, zoom, window). Worth doing early-ish: `main/index.ts` currently sets `autoHideMenuBar: true` and leans on Electron's default menu, and PhotoView already had to work around the default menu's Ctrl/Cmd+Plus/Minus zoom accelerators. An explicit menu makes those bindings ours instead of fought against.

2. Installation guide. Packaging/signing story per platform (macOS notarization, Windows installer), plus a first-run doc.

3. Uninstall guide. Needs an inventory of everything the app writes outside its own bundle — the SQLite DB, thumbnail cache, and downloaded AI model weights all live in `userData` and none of it is currently documented or removable from inside the app. A "remove all app data" affordance in Settings is probably the honest companion to this.

4. Help documentation. In-app help for the non-obvious features (tag groups, exclusions, face detection's reset-on-disable behavior, preview trigger key, compare view).

## AI

1. Auto-album / event clustering. Group photos into events by combining capture time gaps with embedding similarity — closer to Picasa's implicit "shoots" than the current folder-only grouping.

2. Tag suggestion cold start. Suggestions already score against the user's own vocabulary (`useTagSuggestions` passes `allTags` as the candidate labels), which is the right default — but it means the feature can only ever re-suggest tags that already exist, and does nothing at all until the library has some. Worth a seed vocabulary, or a way to propose genuinely new tags, for a library that hasn't been tagged yet.

3. Best-of-burst selection. Rank near-duplicate groups (already detected) by sharpness/exposure/eyes-open so the Duplicates view can recommend which to keep rather than only which are similar.

4. OCR pass for photos containing text (signs, documents, screenshots), stored as a new `ocrText` column on photos and scanned by Shell #3's search engine like any other text field.

Note: any new face/vision model needs a license check first — InsightFace's SCRFD/ArcFace weights are non-commercial-only and were already ruled out once.

## Dashboard

1. Tag This Photo widget shows "every photo is tagged" when there are actually no photos at all. It should show a different message if there are simply no photos.

2. Change the Tagging Progress widget to use a Progress Card style indicator for tagging progress: https://github.com/mantinedev/ui.mantine.dev/blob/master/lib/ProgressCard/ProgressCard.tsx

3. Featured Tag onboarding progress should show toasts each time an action is taken that "ticks a box" until the entire task is completed, with a button to bring you back to the Dashboard view.

4. Top Viewed photos should have an onboarding process similar to Featured Tag to guide users until they've view 5 photos.

## Gallery View

1. Select tag thumbnail photo

2. Cursor multi-select

3. The next view should be...

4. Contact sheet?

5. For Tags and People, make it possible to select a "cover photo." Today we default to the most recent photo from the tag or person, we should be able to manually select one. I would imagine this will be under the right-click menu on gallery view items. Initially I thought it should only appear when a tag or person is selected and filtered (Make cover photo for [tag / person name]). But if the gallery isn't filtered, I think right-clicking a photo should show a Make Cover Photo for [ person in this photo ], and "Make Cover Photo for [ tag on this photo ] with a flyout showing other tags on the photo. That's a lot, so ask for clarification if anything is ambiguous.

6. Full-tab views for each left panel section?

7. Tag folder open/closed state should be persisted. (Reassess overall persisted settings approach to see if this could be optimized or consolidated — the settings layer is now ~26 setting triplets across repository/IPC/preload; see Codebase #5.)

8. Give the container for photo thumbnails in the gallery a dark background so when you're scrolling quickly through the gallery, you still see the box where the photos will render in.

### People

## Tools

1. Undo/redo for tag operations — a toast with an "Undo" action after a batch add/delete/merge, given these can touch many files' actual EXIF data at once.

2. Reset view counts

3. Removing folders should not delete photo data

4. Collage?

5. Color-sorted rainbow - sort/lay out by dominant hue for a gradient wall effect; striking and cheap (just needs a dominant-color extraction pass, no ML needed).

## Tags

1. Selecting multiple photos from the gallery should open the taglist to batch add or remove tags to the entire selection.

## Photo view

1. Refactor Compare view to use Mantine Compare plugin instead of Splitter. I'm okay if this means removing the ability to compare >2 images for now.

2. Photo editing — adopt `react-filerobot-image-editor` for crop/straighten/filters (not a replacement for the existing EXIF-only rotate — keep that as-is, it's lossless and cheap). Notes from research:
   - `onSave` returns base64/canvas, not a file — original EXIF (GPS, date-taken, camera info) is lost on re-encode unless explicitly restored. Plan: base64 → IPC → decode → copy original tags via exiftool-vendored → write via sharp → same `ingestFile`/thumbnail-regen path the current rotate handler uses.
   - No Mantine integration — it's a standalone widget with its own `theme` object (reskinnable to match), dropped in a Mantine `Modal`. Pulls in `react-konva` + `styled-components` as new deps.
   - No plugin API for custom tools/tabs — can only show/hide/reorder the built-in tool set (adjust, filters, rotate, crop, resize, watermark, shapes, text). The DVD/magazine/newspaper visualizations would stay separate, not foldable into its toolbar.
   - Takes a URL or `HTMLImageElement` as source — fits the existing `toFileProtocolUrl` pattern directly.
   - Open question worth settling before building: edit in place, or write a copy and keep the original? Picasa kept originals and stored edits separately; destructive in-place editing is the riskier default.

### Visualizations

1. Move the "X" to be inline with the Visualization ActionIconGroup, make it red.

2. Improve the existing visualizations. They look a little silly.

3. Add "Art Gallery" and "movie theater" visualizations

## Settings

1. I want to be able to reset the view counts globally from the settings menu. This can go under a new section in the settings menu called Photos. I also want to be able reset view count per-image. A little "reset" icon should appear next to the view count on hover (similar to the pencil edit icon), with a tooltip that says "Reset view counter." There should be a warning that this action is irreversible / are you sure, following the same pattern as deleting a folder in the settings menu.

## Optimization

1. Virtualize the Tags panel list (and People panel, same shape). With hundreds of tags, every row mounts a `useDroppable`/`useDraggable` registration, so dnd-kit's `DroppableContainersMap` iterating all of them costs ~550ms at drag start and again at drop. Severity scales with tag count — a library with a few dozen tags likely won't notice this at all, so it's worth confirming it's still felt before investing in the redesign below. `react-window` is already a dependency and `GalleryGrid` uses its `Grid`. Complication worth planning around: the panel renders inside a Mantine `Accordion` when tag groups exist, so a naive per-panel virtualizer doesn't fit — likely wants a single flat virtualized list of (group header | tag) rows instead.

2. Profile the production build, never dev, for any renderer perf work. React 19 DEV calls `console.createTask` for every element (Owner Stacks) and StrictMode double-renders everything; in a dev trace that machinery was ~28% of samples and app code measured 0.02%, which is actively misleading. `npm run build && npm run preview`.

## Video

See VIDEO_PLAN.md

## Codebase

1. Storybook or env config? Need a way to preview things without affecting data.

2. Enforce component export style

3. Update all deps

4. Take a full pass to reduce comments to 1-2 lines

5. Collapse the settings boilerplate. Each setting currently costs five coordinated edits — `shared/types.ts`, a repository get/set pair, the `getAllSettings` composition, an IPC handler, and a preload wrapper — for what is almost always a key/value read and write. A declarative registry (key, codec, default) could generate the accessors, the batch composition, and the handler registration from one entry. Related to Gallery View #7's "reassess persisted settings approach."

6. `@state` barrel is mocked wholesale in ~15 component test files, so anything newly exported from it is `undefined` in those tests and breaks them at import time. Plain constants are currently imported from their defining module to sidestep this. Worth deciding on a real convention (partial mocks via `importOriginal`, or a constants module outside the barrel) before it bites again.

### Performance

1. `GalleryListView`'s rows now avoid per-row context subscriptions, but `CompareView`, the PhotoView visualization themes, and several DetailPanel sections still call `usePhotoLibrary()` deep in their trees. Worth a pass with the production build (see Optimization #2) to see which actually cost anything before refactoring.
