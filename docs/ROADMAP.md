# Roadmap

This document serves as a roadmap of feature to implement, generally in no particular order.

# Bug Fixes

2. Gallery preview zoom is not very smooth and doesn't zoom in enough

3. The duplicates tab keeps showing the "AI features ready" toast every time you open it, well after AI features have been enabled.

4. Duplicate scan still freezes up the app. If we can't get the app to run smoothly independent of these background jobs, there should be a full end-to-end process when AI features are enabled that takes over the window so the user is prevented from trying to keep working while everything is slow and janky.

5. We need to globally disable "space bar to page down" as it interferes with the spacebar preview.

6. Double check if this is the case but the throwback widget should not re-calculate every time the tab is opened. Once per session.

7. Clicking a suggested tag from the photo view brings you back to the gallery and doesn't apply the tag

# Features

To-dos, tasks, and features loosely grouped by feature segment.

## Shell

2. Implement MenuBar?

3. Add a message on the opening loading screen if new photos are detected / being imported, to alert users that opening the app may take a little longer.

4. Corrupt photo finder

5. I want a global way to "ignore" a folder from appearing in the various features, including AI features. Ex. If there's a folder called "test", I should be able to right click it in the folder tree and say "Exclude from features" or something like that. In that case, it should not show up basically anywhere except if the folder is navigated to directly., All tag-ignored folders should show up in the Settings Menu under a new subsection in the Library tab.

## AI

- Face detection?

- Disabling AI should actually uninstall the models, not just hide the features from the UI.

- There may be corrupt or improperly tagged photos in libraries — AI scans (tag suggestions, duplicate detection, Time Warp) should silently skip photos that fail to process instead of erroring out the whole request, and add a note on the photo that it's corrupted/unsupported and may not work with AI features.

## Navigation

1. Truncate photo filenames in the tabs so more can fit. Hovering over the tab should reveal the full filename as a tooltip.

## Dashboard

2. I can't see the Time Warp timeline preview at all now.

3. The blacked-out photo in the bar chart issue isn't resolved. And we lost the space bar preview and clickable bars. There should be unit tests for all of this so it's less likely to regress.

4. The Aspect Ratio on the Tag This Photo didn't work, again.

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

4. Export database

5. Removing folders should not delete photo data

6. Collage?

7. Color-sorted rainbow - sort/lay out by dominant hue for a gradient wall effect; striking and cheap (just needs a dominant-color extraction pass, no ML needed).

## Tags

1. Hovering over tags anywhere in the app should show a Popover Card with the full tag name and description (if available), after a short delay. Make sure this is shared functionality (hook or wrapper component), do not duplicate the Popover layout in multiple places.

2. Selecting multiple photos from the gallery should open the taglist to batch add or remove tags to the entire selection.

## Photo view

1. Adopt `react-filerobot-image-editor` for crop/straighten/filters (not a replacement for the existing EXIF-only rotate — keep that as-is, it's lossless and cheap). Notes from research:
   - `onSave` returns base64/canvas, not a file — original EXIF (GPS, date-taken, camera info) is lost on re-encode unless explicitly restored. Plan: base64 → IPC → decode → copy original tags via exiftool-vendored → write via sharp → same `ingestFile`/thumbnail-regen path the current rotate handler uses.
   - No Mantine integration — it's a standalone widget with its own `theme` object (reskinnable to match), dropped in a Mantine `Modal`. Pulls in `react-konva` + `styled-components` as new deps.
   - No plugin API for custom tools/tabs — can only show/hide/reorder the built-in tool set (adjust, filters, rotate, crop, resize, watermark, shapes, text). The DVD/magazine/newspaper visualizations would stay separate, not foldable into its toolbar.
   - Takes a URL or `HTMLImageElement` as source — fits the existing `toFileProtocolUrl` pattern directly.

### Visualizations

1. Move the "X" to be inline with the Visualization ActionIconGroup, make it red.

2. Refine visualizations...

3. Add "Art Gallery" and "movie theater" visualizations

## Settings

1. I want to be able to reset the view counts globally from the settings menu. This can go under a new section in the settings menu called Photos. I also want to be able reset view count per-image. A little "reset" icon should appear next to the view count on hover (similar to the pencil edit icon), with a tooltip that says "Reset view counter." There should be a warning that this action is irreversible / are you sure, following the same pattern as deleting a folder in the settings menu.

2. Clean up AI enable flag UX

3. Export db, clear db

## Optimization

## Duplicates View

1. Add actions like delete, merge, show in folder, etc.

## Codebase

1. Storybook or env config? Need a way to preview things without affecting data.

2. Enforce component export style

3. Update all deps
