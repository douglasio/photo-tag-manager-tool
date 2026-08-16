# Roadmap

This document serves as a roadmap of feature to implement, generally in no particular order.

# Bug Fixes

# Features

To-dos, tasks, and features loosely grouped by feature segment.

## Shell

2. Implement MenuBar?

3. Add a message on the opening loading screen if new photos are detected / being imported, to alert users that opening the app may take a little longer.

4. Corrupt photo finder

5. I want a global way to "ignore" a folder from appearing in the various features, including AI features. Ex. If there's a folder called "test", I should be able to right click it in the folder tree and say "Exclude from features" or something like that. Let's nail down the exact wording that would make sense to users. If they mark a folder as ignored, it should not show up basically anywhere except in the folder tree. Photos within it should not show up in tags, be factored into tag suggestions, timeline, featured widgets, duplicates, etc. All tag-ignored folders should show up in the Settings Menu under a new subsection in the Library tab where they can be un-ignored.

6. Search -- implement spotlight search. searchable fields should include tags, filename, comments. As a future enhancement, maybe an AI-based search that can match to photo contents or faces.

7. Initial state -- use Mantine EmptyState to improve the how the app looks before any photos have been added. I think maybe some placeholder elements are warranted to show how the app is meant to look after photos have been added. And we need more features like the Featured Tag onboarding process for other widgets and areas of the app to guide users on how to get things populated.

8. Make all 'Enable AI features' buttons use the gradient variant.

9. Video support?

## Onboarding

1. Installation guide?

## AI

1. Face detection?

2. Disabling AI should actually uninstall the models, not just hide the features from the UI.
3.
4. Enabling AI features needs to be cleaned up -- inconsistent dialogs, nonfunctional cancel button behavior, app slowdown while installation is happening, etc.

5. There may be corrupt or improperly tagged photos in libraries — AI scans (tag suggestions, duplicate detection, Time Warp) should silently skip photos that fail to process instead of erroring out the whole request, and add a note on the photo that it's corrupted/unsupported and may not work with AI features.

6. Face detection follow-ups (deferred out of the initial build):
   - Download the YuNet/SFace models on demand (like the CLIP models already do via `@huggingface/transformers`, cached to `userData`) instead of bundling them in `resources/models/` — right now every install pays their ~37MB regardless of whether face detection is ever turned on, which is backwards for what's meant to be the more optional/heavier of the two AI features. Would need its own download/cache/checksum-verification path (no Hub-hosted `pipeline()`-compatible checkpoint to piggyback on) plus the corresponding "downloading" progress phase in the enable/scan flow.
   - Crop the People panel's cover thumbnail to the actual face region instead of showing the full photo — DetailPanelFaces already does this via a CSS crop, PeoplePanel's cover doesn't yet.
   - Filter the gallery by person, the same way tag filtering works today.
   - Centroid refinement: once a person has a few manually-confirmed faces, average their embeddings into a refined match target for future auto-clustering passes, instead of relying solely on the raw DBSCAN cluster centroid.
   -

## Dashboard

1. Tag This Photo widget shows "every photo is tagged" when there are actually no photos at all. It should show a different message if there are simply no photos.

2. Change the Tagging Progress widget to use a Progress Card style indicator for tagging progress: https://github.com/mantinedev/ui.mantine.dev/blob/master/lib/ProgressCard/ProgressCard.tsx

3. Featured Tag onboarding progress should show toasts each time an action is taken that "ticks a box" until the entire task is completed, with a button to bring you back to the Dashboard view.

4. Top Viewed photos should have an onboarding process similar to Featured Tag to guide users until they've view 5 photos.

5. Featured Person widget -- roughly the same as the Featured Tag widget except with a person's face and other stats like

6. The top

## Gallery View

1. Select tag thumbnail photo

2. Cursor multi-select

3. The next view should be...

4. Contact sheet?

5. For Tags and People, make it possible to select a "cover photo." Today we default to the most recent photo from the tag or person, we should be able to manually select one. I would imagine this will be under the right-click menu on gallery view items. Initially I thought it should only appear when a tag or person is selected and filtered (Make cover photo for [tag / person name]). But if the gallery isn't filtered, I think right-clicking a photo should show a Make Cover Photo for [ person in this photo ], and "Make Cover Photo for [ tag on this photo ] with a flyout showing other tags on the photo. That's a lot, so ask for clarification if anything is ambiguous.

6. Full-tab views for each left panel section?

7. ~~The gallery sidebar is overall rather laggy -- resizing the panels, expanding/collapsing folders, selecting items, dragging and dropping. Can you investigate and see if there's a way to get this experience to be smoother?~~ Fixed. Measured via DevTools traces of the **production** build (dev-mode traces are useless here — React 19 DEV calls `console.createTask` per element for Owner Stacks, which with StrictMode's double-render drowned out all real signal at ~28% of samples). Per-pointermove input cost went 22.4ms → 4.22ms (60fps budget is 16.67ms) and GC 4.85s → 1.8s across four fixes, in descending order of impact:
   - **Closed dialogs were mounted per row.** Every `TagListItem` unconditionally rendered two Mantine `Modal`s (rename + delete) plus a `Tooltip`; a `Modal` with `opened={false}` still renders its whole `ModalBase`/`Transition`/overlay tree. With hundreds of tags that was ~1000 floating-UI subtrees re-rendering per pass (`_Box` alone was 1221ms). Now mounted only while open — also applied to `TagGroupSection`, `PersonRow`, `FolderRemoveButton`, `PhotoContextMenu`.
   - **`useDndContext()` in per-row components.** dnd-kit's `publicContext` memo lists `collisions` as a dependency, which is recomputed on _every pointermove_, so all ~300 rows re-rendered continuously mid-drag. Rows now read `ActiveDragContext` (a plain `string | null` derived from `App.tsx`'s existing `activeDrag` state) instead, changing twice per drag rather than ~100 times.
   - **Heavy row subtree coupled to dnd-kit's `InternalContext`** (whose memo depends on `over`, i.e. the hovered drop target — this was the "clunky when you reach the target" symptom). `TagListItem` is now a thin dnd-wiring shell around a memoized `TagListItemView`; `attributes`/`listeners`/`setNodeRef` are stable in dnd-kit's own source, so only the 1-2 rows whose `isOver`/`isDragging` actually changed re-render.
   - **`activeDrag` lives in `AppLayout`**, so drag start/end re-rendered the entire app tree. `GalleryGrid`/`DashboardView`/`DetailPanel` take no props and are now `memo`'d so they bail out.

   Also landed alongside (real but smaller): the Splitter now commits to the reducer/IPC on release instead of ~60x/sec during a drag, and `PhotoLibraryContext` was split into `PhotoLibraryActionsContext`/`PhotoLibrarySidebarContext`/`PhotoLibraryGalleryContext` with the sidebar migrated onto the narrow hooks. Note the context split was _not_ what fixed the reported lag — app-code render time measured 0.02% of the profile — but it's sound architecture and removes the "any dispatch re-renders all 53 consumers" ceiling. Gallery/Dashboard/DetailPanel/Settings still use the fully-compatible `usePhotoLibrary()` shim.

   **Known remaining cost:** two ~550ms stalls at drag start and at drop, dominated by dnd-kit's `DroppableContainersMap` iterating every registered droppable (~300 tag rows). The fix is virtualizing the tag list (`react-window` is already a dependency and `GalleryGrid` uses it) so only ~25 rows mount at a time. See Optimization below.

8. Make the left sidebar wider by default.

9. Tag folder open/closed state should be persisted. (Reassess overall persisted settings approach to see if this could be optimized or consolidated)

10. Make the breadcrumb section headers sticky so it's easier to tell what section you're in

11. Give the container for photo thumbnails in the gallery a dark background so when you're scrolling quickly through the gallery, you still see the box where the photos will render in.

### People

1. Make People the middle panel, between Folders and Tags.

2. Fix the side panel divider resizing -- now that there are two dividers, neither of them allow resizing and I assume both positions are not persisted.

3. Make each panel (Tags, People, Folders) collapsible (accordion-style) and persist the settings.

4. Allow for hiding People -- a new context menu item when right-clicking an item in the People panel - hide them from the UI and don't re-suggest that grouping of faces. Add all hidden people to the People section in the Settings modal so they can be un-hidden. This is different from "delete" which just ungroups that selection of faces until the next scan. Confirm dialogs should be updated to explain this.

5. Allow descriptions to be added to People, same pattern we used for Tags.

6. Apply the 2-column tile alternate layout we used for the tags panel to the people panel, with the same persisted toggle and functionality.

## Tools

2. Undo/redo for tag operations — a toast with an "Undo" action after a batch add/delete/merge, given these can touch many files' actual EXIF data at once.

3. Reset view counts

4. Removing folders should not delete photo data

5. Collage?

6. Color-sorted rainbow - sort/lay out by dominant hue for a gradient wall effect; striking and cheap (just needs a dominant-color extraction pass, no ML needed).

## Tags

2. Selecting multiple photos from the gallery should open the taglist to batch add or remove tags to the entire selection.

## Photo view

1. Refactor Compare view to use Mantine Compare plugin instead of Splitter. I'm okay if this means removing the ability to compare >2 images for now.

2. Adopt `react-filerobot-image-editor` for crop/straighten/filters (not a replacement for the existing EXIF-only rotate — keep that as-is, it's lossless and cheap). Notes from research:
   - `onSave` returns base64/canvas, not a file — original EXIF (GPS, date-taken, camera info) is lost on re-encode unless explicitly restored. Plan: base64 → IPC → decode → copy original tags via exiftool-vendored → write via sharp → same `ingestFile`/thumbnail-regen path the current rotate handler uses.
   - No Mantine integration — it's a standalone widget with its own `theme` object (reskinnable to match), dropped in a Mantine `Modal`. Pulls in `react-konva` + `styled-components` as new deps.
   - No plugin API for custom tools/tabs — can only show/hide/reorder the built-in tool set (adjust, filters, rotate, crop, resize, watermark, shapes, text). The DVD/magazine/newspaper visualizations would stay separate, not foldable into its toolbar.
   - Takes a URL or `HTMLImageElement` as source — fits the existing `toFileProtocolUrl` pattern directly.

### Visualizations

1. Move the "X" to be inline with the Visualization ActionIconGroup, make it red.

2. Improve the existing visualizations. They look a little silly.

3. Add "Art Gallery" and "movie theater" visualizations

## Settings

1. I want to be able to reset the view counts globally from the settings menu. This can go under a new section in the settings menu called Photos. I also want to be able reset view count per-image. A little "reset" icon should appear next to the view count on hover (similar to the pencil edit icon), with a tooltip that says "Reset view counter." There should be a warning that this action is irreversible / are you sure, following the same pattern as deleting a folder in the settings menu.

## Optimization

1. Virtualize the Tags panel list (and People panel, same shape). Follow-up from Gallery View #7: with hundreds of tags, every row mounts a `useDroppable`/`useDraggable` registration, so dnd-kit's `DroppableContainersMap` iterating all of them costs ~550ms at drag start and again at drop. Severity scales with tag count — a library with a few dozen tags likely won't notice this at all, so it's worth confirming it's still felt before investing in the redesign below. `react-window` is already a dependency and `GalleryGrid` uses its `Grid`. Complication worth planning around: the panel renders inside a Mantine `Accordion` when tag groups exist, so a naive per-panel virtualizer doesn't fit — likely wants a single flat virtualized list of (group header | tag) rows instead.

2. Profile the production build, never dev, for any renderer perf work. React 19 DEV calls `console.createTask` for every element (Owner Stacks) and StrictMode double-renders everything; in a dev trace that machinery was ~28% of samples and app code measured 0.02%, which is actively misleading. `npm run build && npm run preview`.

## Video

See VIDEO_PLAN.md

## Codebase

1. Storybook or env config? Need a way to preview things without affecting data.

2. Enforce component export style

3. Update all deps

4. Centralize the repeated `photo.thumbnailStatus === 'ready' && photo.thumbnailKey` check (inline in ~13 places across Dashboard widgets, Gallery, and Tags) into a shared `isPhotoDisplayable(photo)`-style helper.

5. Dashboard widgets each call `useKeyHeld(PREVIEW_TRIGGER_KEY)` independently (6 separate window keydown/keyup listener pairs for the same key). Fold `previewTriggerHeld` into the shared `DashboardPreviewZoomContext` (already built for per-widget preview zoom) so it's one listener instead of six.

6. Take a full pass to reduce comments to 1-2 lines

### Performance

Found while investigating startup/dashboard/gallery-tab/photo-open sluggishness — none implemented yet. Keep inline comments to 1-2 lines when landing any of these (see #6 above for why).

1. ~~Startup is fully gated behind re-verifying every photo in the library.~~ Fixed. `PhotoLibraryContext`'s mount effect now flips `initialLoadComplete` right after `FOLDERS_LOADED`, instead of awaiting the full `startScanForAll` (which doesn't resolve until every file's metadata _and_ thumbnail check finish). `AppGate` renders `AppLayout` immediately; photos populate progressively via the already-existing `METADATA_BATCH` streaming. `DashboardView` (which, unlike `GalleryGrid`, didn't previously distinguish "still scanning" from "genuinely empty") now shows a scanning indicator instead of the "Add a folder" empty state while `state.status === 'scanning'`.

2. ~~27 independent IPC round-trips fire on mount.~~ Fixed. Added `settingsRepository.getAllSettings()`/`settings:getAllSettings`, batching the ~20 settings-table reads `PhotoLibraryContext.tsx` used to fire as one `useEffect` each into a single round-trip (dispatched via one new `SETTINGS_LOADED` reducer action). `getFolders` stays a separate call (drives the startup scan) but fetches in parallel via `Promise.all` with `getAllSettings`, so mount is now 2 IPC calls instead of ~21.

3. Three dashboard widgets re-sort the whole library, unmemoized, on every one of those 27 renders. `RecentlyAddedWidget`, `TopTagsWidget`, and `TopViewedWidget` all do `Array.from(activePhotosByPath.values()).sort(...)` directly in the render body with no `useMemo`, and all three still use the broad back-compat `usePhotoLibrary()` instead of the narrow `useGalleryLibrary()`/`useSidebarLibrary()` hooks — so they re-render (and re-sort the full library) on every settling dispatch from #2. Fix: memoize the sort/filter and migrate off `usePhotoLibrary()`. Keep inline comments to 1-2 lines.

4. `main.tsx` eagerly loads 6 font families used by almost nothing. `bebas-neue`, 4 weights of `playfair-display`, `anton`, and `unifrakturmaguntia` are all imported at module scope and loaded/parsed on every launch, but they're only referenced by the 5 niche PhotoView "cover" themes (Magazine/Newspaper/DVD/Art Gallery/Movie Theater) most sessions never open. Lazy-load each only when its theme view actually mounts. Keep inline comments to 1-2 lines.

5. Opening any photo instantiates 5x pannable-zoom state, 4 of which are always thrown away. `PhotoView.tsx` unconditionally calls `usePannableZoom()` five times (once per theme), even though only one theme is ever active and the plain view (`visualization === 'none'`, the common case) uses none of them — that's 25 wasted `useState` calls and 5 wasted wheel-listener attachments on every single photo you double-click into. Fix: move each theme's `usePannableZoom()` call into its own component instead of `PhotoView` calling all 5 up front. Keep inline comments to 1-2 lines.
