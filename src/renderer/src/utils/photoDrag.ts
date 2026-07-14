// Custom MIME type carrying the dragged photo path(s) through the native
// HTML5 drag-and-drop API (gallery thumbnail -> tag panel row).
const PHOTO_DRAG_MIME_TYPE = 'application/x-photag-photo-paths'

export function setDraggedPhotoPaths(dataTransfer: DataTransfer, paths: string[]): void {
  dataTransfer.setData(PHOTO_DRAG_MIME_TYPE, JSON.stringify(paths))
  dataTransfer.effectAllowed = 'copy'
}

// Chromium only exposes dataTransfer.types (not the actual payload) during
// dragover/dragenter for security reasons — getData() only works on drop —
// so drop targets use this to decide whether to show "can drop here" feedback.
export function hasDraggedPhotoPaths(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(PHOTO_DRAG_MIME_TYPE)
}

export function getDraggedPhotoPaths(dataTransfer: DataTransfer): string[] {
  const raw = dataTransfer.getData(PHOTO_DRAG_MIME_TYPE)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}
