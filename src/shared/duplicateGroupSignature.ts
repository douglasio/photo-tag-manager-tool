// Duplicate groups have no ID of their own — clustering recomputes them
// fresh from embeddings on every scan — so a dismissed group is identified
// by this stable signature (sorted file paths, joined) instead.
export function computeDuplicateGroupSignature(filePaths: string[]): string {
  return [...filePaths].sort().join('|')
}
