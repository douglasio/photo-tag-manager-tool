# Roadmap

This document serves as a roadmap of feature to implement, generally in no particular order.

# Bug Fixes

- Gallery preview zoom is not very smooth and doesn't zoom in enough

# Features

To-dos, tasks, and features loosely grouped by feature segment.

## Optimization

1. [possibly already resolved] During photo import of a large number of files, app performance degraded significantly. This should be a background process that doesn't hold up the main

## Shell

1. Both the details pane and the left folder / tag panel should be resizable using Mantine Splitter with the no handle setting. Tags and Folders panels within the left sidebar should also be vertically resizable using the same component but vertically oriented. All of these positioning settings should be persisted.

## Navigation

1. Truncate photo filenames in the tabs so more can fit. Hovering over the tab should reveal the full filename as a tooltip.

2. Add a close all button at the right of the tabs row that will close all open tabs and return to gallery.

3. Make the tab row horizontally scroll instead of wrap to multiple lines. I think this can be achieved with Mantine's Scroller component.

## Gallery View

1. Select tag thumbnail photo

2. Create an alternate display option for the tags panel. This one is a 2-column grid of the tag thumbnails with the tag name and image count overlayed on top of the thumbnail, using Mantine's BackgroundImage component. Use the settings cog pattern used in the Folder section to put the toggle for this.

## Tools

2. Undo/redo for tag operations — a toast with an "Undo" action after a batch add/delete/merge, given these can touch many files' actual EXIF data at once.

3. Suggested tags?

4. Reset view counts

5. Export database

6. Removing folders should not delete photo data

## Details Panel

1. When multiple photos are selected, we should replace the simple photo count view with options for multi-photo select. I want to see two sections - one that's a button to Compare (same functionality and icon as the one that appears at the top of the gallery). The second should display a list of all the tags in all the photos selected. It should utilize the same TagList format as other areas. From here, you should be able to batch add or batch delete any of the tags from the selected photos.

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

1. Refactor the settings menu into a multi-tab list (Mantine Tabs, configured vertically), the first tab being "Settings" and the second being "Keyboard Shortcuts" with a list of all keyboard shortcuts built into the app, making use of Mantine Kbd to show keys when appropriate

2. I want to be able to reset the view counts globally from the settings menu. This can go under a new section in the settings menu called Photos. I also want to be able reset view count per-image. A little "reset" icon should appear next to the view count on hover (similar to the pencil edit icon), with a tooltip that says "Reset view counter." There should be a warning that this action is irreversible / are you sure, following the same pattern as deleting a folder in the settings menu.

## Codebase

1. Storybook or env config? Need a way to preview things without affecting data.
