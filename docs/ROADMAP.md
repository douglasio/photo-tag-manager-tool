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

## AI

1. Face detection?

2. Disabling AI should actually uninstall the models, not just hide the features from the UI.

3. There may be corrupt or improperly tagged photos in libraries — AI scans (tag suggestions, duplicate detection, Time Warp) should silently skip photos that fail to process instead of erroring out the whole request, and add a note on the photo that it's corrupted/unsupported and may not work with AI features.

4. Face detection follow-ups (deferred out of the initial build):
   - Crop the People panel's cover thumbnail to the actual face region instead of showing the full photo — DetailPanelFaces already does this via a CSS crop, PeoplePanel's cover doesn't yet.
   - Filter the gallery by person, the same way tag filtering works today.
   - Centroid refinement: once a person has a few manually-confirmed faces, average their embeddings into a refined match target for future auto-clustering passes, instead of relying solely on the raw DBSCAN cluster centroid.

## Dashboard

### Throwback Widget

1. Let's ramp up the similarity threshold a bit on the Throwback widget timeline -- getting some really odd choices in there. There should be logic to skip a year if no images are found that are similar enough.

## Gallery View

1. Select tag thumbnail photo

2. Cursor multi-select

3. The next view should be...

4. Contact sheet?

## Tools

2. Undo/redo for tag operations — a toast with an "Undo" action after a batch add/delete/merge, given these can touch many files' actual EXIF data at once.

3. Reset view counts

4. Removing folders should not delete photo data

5. Collage?

6. Color-sorted rainbow - sort/lay out by dominant hue for a gradient wall effect; striking and cheap (just needs a dominant-color extraction pass, no ML needed).

## Tags

2. Selecting multiple photos from the gallery should open the taglist to batch add or remove tags to the entire selection.

## Photo view

1. Adopt `react-filerobot-image-editor` for crop/straighten/filters (not a replacement for the existing EXIF-only rotate — keep that as-is, it's lossless and cheap). Notes from research:
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

## Duplicates View

## Codebase

1. Storybook or env config? Need a way to preview things without affecting data.

2. Enforce component export style

3. Update all deps

4. Centralize the repeated `photo.thumbnailStatus === 'ready' && photo.thumbnailKey` check (inline in ~13 places across Dashboard widgets, Gallery, and Tags) into a shared `isPhotoDisplayable(photo)`-style helper.

5. Dashboard widgets each call `useKeyHeld(PREVIEW_TRIGGER_KEY)` independently (6 separate window keydown/keyup listener pairs for the same key). Fold `previewTriggerHeld` into the shared `DashboardPreviewZoomContext` (already built for per-widget preview zoom) so it's one listener instead of six.
