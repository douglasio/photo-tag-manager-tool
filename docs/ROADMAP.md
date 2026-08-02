# Roadmap

This document serves as a roadmap of feature to implement, generally in no particular order.

# Bug Fixes*

- the tag in the gallery header looks crazy when in edit mode. Maybe move this edit toggle to the tag panel to be consistent with the folder list

# Features

To-dos, tasks, and features loosely grouped by feature segment.

## Optimization

1. During photo import of a large number of files, app performance degraded significantly. This should be a background process that doesn't hold up the main

## Shell

1. [] Both the details pane and the left folder / tag panel should be resizable using Mantine Splitter with the no handle setting. Tags and Folders panels within the left sidebar should also be vertically resizable using the same component but vertically oriented. All of these positioning settings should be persisted.

## Dashboard

1. Create a welcome Dashboard view. Requirements:

- Create all components for this under src/components/Dashboard
- Add a persistent setting in the settings modal to allow the user to toggle between Dashboard and Gallery as the default view when opening the app, and check for that flag when the app runs to know which view to load into.
- Dashboard should be pinned as the first tab (before Gallery) when tabs are visible.
- Dashboard view is full-screen -- no side panels.
- Leave the dashboard view itself blank for now, except for a barebones grid layout that scales from 1 / 2 / 3 columns based on screen size. In one of the grid cells, include a button to go to the Gallery view.

## Navigation

1. Truncate photo filenames in the tabs so more can fit. Hovering over the tab should reveal the full filename as a tooltip.

2. Add a close all button at the right of the tabs row that will close all open tabs and return to gallery.

3. Make the tab row horizontally scroll instead of wrap to multiple lines. I think this can be achieved with Mantine's Scroller component.

## Metadata

1. I want to be able to reset the view counts globally from the settings menu. This can go under a new section in the settings menu called Photos. I also want to be able reset view count per-image. A little "reset" icon should appear next to the view count on hover (similar to the pencil edit icon), with a tooltip that says "Reset view counter." There should be a warning that this action is irreversible / are you sure, following the same pattern as deleting a folder in the settings menu.

## Write features

Note: For all field "edit" features, interactivity should follow the same resuable pattern as tag editing - subtle edit ActionIcon appears on hover, clicking the icon or double-clicking the content should enable edit mode, enter saves the change, esc cancels it. Don't use a ConfirmDialog gate unless the action is risky or affects a number of files.

## Gallery View

1. Sort by view count

2. Select tag thumbnail photo

3. Create an alternate display option for the tags panel. This one is a 2-column grid of the tag thumbnails with the tag name and image count overlayed on top of the thumbnail, using Mantine's BackgroundImage component. Use the settings cog pattern used in the Folder section to put the toggle for this.

4. Sort tags by count, alpha, most recent

5. Rename tag and update all

6. Update the keyboard tooltip hint about pressing ctrl to use the Mantine Kbd component

## Tools

1. Bulk untag — the inverse of batch add: select photos + a tag, remove it from all of them at once (exists implicitly via delete-tag-globally, but not "remove this one tag from just this selection").

2. Undo/redo for tag operations — a toast with an "Undo" action after a batch add/delete/merge, given these can touch many files' actual EXIF data at once.

3. Suggested tags?

4. Reset view counts

5. Export database

## Details Panel

1. Make sure the details panel is not horizontally scrollable--it appears fields like folder path can stretch the panel beyond its width.

2. When multiple photos are selected, we should replace the simple photo count view with options for multi-photo select. I want to see two sections - one that's a button to Compare (same functionality and icon as the one that appears at the top of the gallery). The second should display a list of all the tags in all the photos selected. It should utilize the same TagList format as other areas. From here, you should be able to batch add or batch delete any of the tags from the selected photos.

## Photo view

5. The image rotation issue persists

## Codebase

(none)
