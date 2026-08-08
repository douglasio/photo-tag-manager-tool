# Roadmap

This document serves as a roadmap of feature to implement, generally in no particular order.

# Bug Fixes

- Gallery preview zoom is not very smooth and doesn't zoom in enough

# Features

To-dos, tasks, and features loosely grouped by feature segment.

## Shell

1. [Tags/Folders vertical split done, persisted] The details pane and the left folder/tag panel (the sidebar's overall width, not the Tags/Folders split within it) should still be resizable using Mantine Splitter with the no handle setting, persisted. Blocked on reconciling Splitter's own flex-pane sizing with AppShell's Navbar/Aside, which currently own width + collapse-animation via their own `width`/`collapsed` config rather than a Splitter pane.

2. Implement MenuBar?

3. Add a message on the opening loading screen if new photos are detected / being imported, to alert users that opening the app may take a little longer.

4. Corrupt photo finder

5. Implement an "untagged photos" filter for the Gallery. It should live in the Tags Panel in the gallery view navbar. It should just filter the gallery to only untagged photos. It should also be linked from the Tagging Progress widget, under the donut chart (and if you click the untagged photos segment of the donut chart).

6. I want to be able to ignore tags in certain folders, like archive folders and backups. I want to be able to right-click on a folder in the tree and say "ignore tags" which would add a little icon on the folder to indicate that it's ignored. Same right-click menu option should reverse the action. All tag-ignored folders should show up in the Settings Menu under a new subsection in the Library tab called Tags

## Navigation

1. Truncate photo filenames in the tabs so more can fit. Hovering over the tab should reveal the full filename as a tooltip.

## Dashboard

## Gallery View

1. Select tag thumbnail photo

2. Cursor multi-select

## Tools

2. Undo/redo for tag operations — a toast with an "Undo" action after a batch add/delete/merge, given these can touch many files' actual EXIF data at once.

3. Suggested tags?

4. Reset view counts

5. Export database

6. Removing folders should not delete photo data

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

## Codebase

1. Storybook or env config? Need a way to preview things without affecting data.

2. Enforce component export style

3. Update all deps
