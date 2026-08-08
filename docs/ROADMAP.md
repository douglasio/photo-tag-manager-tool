# Roadmap

This document serves as a roadmap of feature to implement, generally in no particular order.

# Bug Fixes

- Gallery preview zoom is not very smooth and doesn't zoom in enough

- The gap with the embedding scan being lazy / on-demand is if they enable Time Warp, the embeddings are added to all photos, and then new photos are added to the library, there will never be a re-trigger of the embed for the new photos so they'd never appear in the Time Warp widget. I think every time a new photo is added after enabling that feature, an embedding is also created as it's scanned. And then we can just add a setting in the settings menu to disable Time Warp at any time, which would turn off this scan.

# Features

To-dos, tasks, and features loosely grouped by feature segment.

## Shell

2. Implement MenuBar?

3. Add a message on the opening loading screen if new photos are detected / being imported, to alert users that opening the app may take a little longer.

4. Corrupt photo finder

5. I want to be able to ignore tags in certain folders, like archive folders and backups. I want to be able to right-click on a folder in the tree and say "ignore tags" which would add a little icon on the folder to indicate that it's ignored. Same right-click menu option should reverse the action. All tag-ignored folders should show up in the Settings Menu under a new subsection in the Library tab called Tags

## AI

- Face detection?

## Navigation

1. Truncate photo filenames in the tabs so more can fit. Hovering over the tab should reveal the full filename as a tooltip.

## Dashboard

## Gallery View

1. Select tag thumbnail photo

2. Cursor multi-select

3. The next view should be...

4. Contact sheet?

## Tools

2. Undo/redo for tag operations — a toast with an "Undo" action after a batch add/delete/merge, given these can touch many files' actual EXIF data at once.

3. Reset view counts

4. Export database

5. Removing folders should not delete photo data

6. Collage?

7. X "over the years" same-date-across-years nostalgia view, easy with dateTaken you already have. Ideally should show AI-derived "similar" photos that date back years.

8. Color-sorted rainbow - sort/lay out by dominant hue for a gradient wall effect; striking and cheap (just needs a dominant-color extraction pass, no ML needed).

## Details Panel

## Photo view

1. Adopt `react-filerobot-image-editor` for crop/straighten/filters (not a replacement for the existing EXIF-only rotate — keep that as-is, it's lossless and cheap). Notes from research:
   - `onSave` returns base64/canvas, not a file — original EXIF (GPS, date-taken, camera info) is lost on re-encode unless explicitly restored. Plan: base64 → IPC → decode → copy original tags via exiftool-vendored → write via sharp → same `ingestFile`/thumbnail-regen path the current rotate handler uses.
   - No Mantine integration — it's a standalone widget with its own `theme` object (reskinnable to match), dropped in a Mantine `Modal`. Pulls in `react-konva` + `styled-components` as new deps.
   - No plugin API for custom tools/tabs — can only show/hide/reorder the built-in tool set (adjust, filters, rotate, crop, resize, watermark, shapes, text). The DVD/magazine/newspaper visualizations would stay separate, not foldable into its toolbar.
   - Takes a URL or `HTMLImageElement` as source — fits the existing `toFileProtocolUrl` pattern directly.

### Visualizations

1. Move the "X" to be inline with the Visualization ActionIconGroup, make it red.

2. Refine visualizations...

## Settings

1. I want to be able to reset the view counts globally from the settings menu. This can go under a new section in the settings menu called Photos. I also want to be able reset view count per-image. A little "reset" icon should appear next to the view count on hover (similar to the pencil edit icon), with a tooltip that says "Reset view counter." There should be a warning that this action is irreversible / are you sure, following the same pattern as deleting a folder in the settings menu.

## Optimization

## Duplicates View

1. Add actions like delete, merge, show in folder, etc.

## Codebase

1. Storybook or env config? Need a way to preview things without affecting data.

2. Enforce component export style

3. Update all deps
