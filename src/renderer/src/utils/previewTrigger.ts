// Single source of truth for the key that triggers the hover
// zoom/preview effects — the gallery's floating Ctrl-preview-turned-Space-
// preview, PhotoView's cursor-zoom, and their shared trigger+wheel
// zoom/resize behavior. Change these two to switch the trigger key
// everywhere at once. PREVIEW_TRIGGER_KEY must match a KeyboardEvent.key
// value (e.g. 'Control', not the .code value 'ControlLeft').
export const PREVIEW_TRIGGER_KEY = ' '
export const PREVIEW_TRIGGER_KEY_LABEL = 'Space'
