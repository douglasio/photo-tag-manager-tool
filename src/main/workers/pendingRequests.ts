// Shared by every service that lazily spawns a worker_thread and tracks
// in-flight requests by id (tagSuggestionService, duplicatePhotoService,
// throwbackService) — rejecting every pending caller and clearing the map
// is identical everywhere a worker errors or gets disposed; only the
// request/response message shapes differ per service.
export function rejectAllPending<T extends { reject: (err: Error) => void }>(
  pending: Map<number, T>,
  error: Error
): void {
  for (const { reject } of pending.values()) reject(error)
  pending.clear()
}
