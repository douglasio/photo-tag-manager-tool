# Roadmap

This document serves as a roadmap of feature to implement, generally in no particular order.

# Bug Fixes

# Features

To-dos, tasks, and features loosely grouped by feature segment.

## Shell

2. Implement MenuBar?

3. Add a message on the opening loading screen if new photos are detected / being imported, to alert users that opening the app may take a little longer.

4. Corrupt photo finder

5. Search -- implement spotlight search. searchable fields should include tags, filename, comments. As a future enhancement, maybe an AI-based search that can match to photo contents or faces.

6. Initial state -- use Mantine EmptyState to improve the how the app looks before any photos have been added. I think maybe some placeholder elements are warranted to show how the app is meant to look after photos have been added. And we need more features like the Featured Tag onboarding process for other widgets and areas of the app to guide users on how to get things populated.

7. Make all 'Enable AI features' buttons use the gradient variant.

8. Video support?

## Onboarding

1. Installation guide?

## AI

## Dashboard

1. Tag This Photo widget shows "every photo is tagged" when there are actually no photos at all. It should show a different message if there are simply no photos.

2. Change the Tagging Progress widget to use a Progress Card style indicator for tagging progress: https://github.com/mantinedev/ui.mantine.dev/blob/master/lib/ProgressCard/ProgressCard.tsx

3. Featured Tag onboarding progress should show toasts each time an action is taken that "ticks a box" until the entire task is completed, with a button to bring you back to the Dashboard view.

4. Top Viewed photos should have an onboarding process similar to Featured Tag to guide users until they've view 5 photos.

5. ~~Featured Person widget -- roughly the same as the Featured Tag widget except with a few photos of the person and other stats like total view count, total number of photos, and person's description if available~~ Fixed. New "People" dashboard section with `FeaturedPersonWidget`, mirroring `FeaturedTagWidget`'s carousel/onboarding pattern — named people with 3+ photos are eligible; shows photo count, view count, and description; onboarding Timeline walks through enabling face detection and naming someone until one qualifies.

6. Add a "name this person" widget that appears if there are any people with the default name (unnamed person)

## Gallery View

1. Select tag thumbnail photo

2. Cursor multi-select

3. The next view should be...

4. Contact sheet?

5. For Tags and People, make it possible to select a "cover photo." Today we default to the most recent photo from the tag or person, we should be able to manually select one. I would imagine this will be under the right-click menu on gallery view items. Initially I thought it should only appear when a tag or person is selected and filtered (Make cover photo for [tag / person name]). But if the gallery isn't filtered, I think right-clicking a photo should show a Make Cover Photo for [ person in this photo ], and "Make Cover Photo for [ tag on this photo ] with a flyout showing other tags on the photo. That's a lot, so ask for clarification if anything is ambiguous.

6. Full-tab views for each left panel section?

7. Make the left sidebar wider by default.

8. Tag folder open/closed state should be persisted. (Reassess overall persisted settings approach to see if this could be optimized or consolidated)

9. ~~Make the breadcrumb section headers sticky so it's easier to tell what section you're in~~ Fixed. `GalleryFolderSections` now tracks scroll position and overlays the current section's breadcrumb at the top of the list once its real header row has scrolled out of view, with a subtle "handoff" push as the next section's header arrives.

10. Give the container for photo thumbnails in the gallery a dark background so when you're scrolling quickly through the gallery, you still see the box where the photos will render in.

### People

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
