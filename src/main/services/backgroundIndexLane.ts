// Both background indexers (CLIP embeddings, face detection) decode photos
// with sharp and run ONNX inference on every item, so running them at once
// saturates the machine and starves the renderer's compositor. They take
// turns through this counter instead: a would-be starter that finds the lane
// busy re-arms its own debounce and tries again, rather than queueing (which
// would make a stop() wait on the *other* indexer's pass to finish).
let activeCount = 0

export function isLaneBusy(): boolean {
  return activeCount > 0
}

export function enterLane(): void {
  activeCount += 1
}

export function exitLane(): void {
  activeCount = Math.max(0, activeCount - 1)
}
